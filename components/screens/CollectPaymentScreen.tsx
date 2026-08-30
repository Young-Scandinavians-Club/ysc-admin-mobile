import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { api, ApiClientError } from '@/api';
import type { OfflinePaymentMethod } from '@/api/types';
import type { RootStackParamList } from '@/components/navigation/types';
import { ScreenHeader } from '@/components/screens/ScreenHeader';
import { useTapToPayCollector } from '@/lib/stripe-terminal';
import { DEFAULT_TEST_CARD, TEST_CARDS } from '@/lib/testCards';

type Props = NativeStackScreenProps<RootStackParamList, 'CollectPayment'>;

type LocalPhase = 'preparing' | 'finalizing' | 'success' | 'error';

/** A card the customer needs to re-tap (declined / lost network at the reader)
 *  vs. a problem retrying the same card won't fix (our API, config, bad
 *  connection to the backend). Drives the error copy and button label. */
type ErrorKind = 'declined' | 'other';

/** Stripe Terminal SDK error codes that mean "the card itself was refused". */
const DECLINE_CODES = new Set(['DeclinedByStripeAPI', 'DeclinedByReader']);

function classifyError(outcome: { error: string; code?: string }): ErrorKind {
  if (outcome.code != null && DECLINE_CODES.has(outcome.code)) return 'declined';
  return /declin/i.test(outcome.error) ? 'declined' : 'other';
}

const PHASE_MESSAGE: Record<
  'preparing' | 'connecting' | 'collecting' | 'processing' | 'finalizing',
  string
> = {
  preparing: 'Preparing payment…',
  connecting: 'Connecting to reader…',
  collecting: 'Tap, insert, or swipe the card',
  processing: 'Processing payment…',
  finalizing: 'Saving membership…',
};

const OFFLINE_METHODS: readonly { id: OfflinePaymentMethod; label: string }[] = [
  { id: 'cash', label: 'Cash' },
  { id: 'check', label: 'Check' },
  { id: 'other', label: 'Other' },
];

/** "$90.00" / "US$90" → "90.00" for a prefilled amount field. */
function amountLabelToInput(label: string): string {
  const digits = label.replace(/[^0-9.]/g, '');
  return digits.replace(/\.(?=.*\.)/g, '');
}

/** "90" / "90.5" → 9000 / 9050 cents; blank or nonsense → null (omit the field). */
function dollarsToCents(input: string): number | null {
  const n = Number.parseFloat(input);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export function CollectPaymentScreen({ navigation, route }: Props) {
  const params = route.params;
  const insets = useSafeAreaInsets();
  const collector = useTapToPayCollector();
  const [localPhase, setLocalPhase] = useState<LocalPhase>('preparing');
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ErrorKind>('other');
  const [testCardId, setTestCardId] = useState(DEFAULT_TEST_CARD.id);
  // Read via a ref (not a `run` dependency) so picking a different test card
  // never re-triggers the mount-time auto-run — it only applies on retry.
  const testCardIdRef = useRef(testCardId);
  useEffect(() => {
    testCardIdRef.current = testCardId;
  }, [testCardId]);
  // Membership only: once collectSetup has actually saved a card, a retry
  // (e.g. subscribeMembership failing after a successful collection) must
  // not collect the card again — Terminal SetupIntents don't move money, but
  // re-collecting is still an unnecessary second card tap, and re-running
  // subscribeMembership from scratch would otherwise recreate the SetupIntent
  // for no reason. subscribeMembership's own idempotency key (member+plan,
  // stable across retries) already makes it safe to call again with the
  // same payment_method_id.
  const collectedPaymentMethodIdRef = useRef<string | null>(null);

  // Offline (cash/check) takeover. Once the volunteer opens the offline form
  // we stop the card collector and ignore any outcome it still reports — the
  // auto-run's in-flight collectPayment/collectSetup can resolve or reject
  // moments later, and without this guard that late result would stomp the
  // success/error screen the offline submission produced.
  //
  // Starts true when the seller long-pressed "Continue" to come straight here
  // in cash mode — that suppresses the mount-time card auto-run entirely
  // (run() bails on this ref), and the effect below opens the form.
  const offlineTakeoverRef = useRef(params.startOffline === true);
  // Bumped every time a card attempt starts (and when the offline form opens).
  // Each run() captures its number and only writes state while it still
  // matches — so a superseded attempt that settles late is a no-op.
  const attemptRef = useRef(0);
  const [offlineOpen, setOfflineOpen] = useState(false);
  const [offlineMethod, setOfflineMethod] = useState<OfflinePaymentMethod>('cash');
  const [offlineNote, setOfflineNote] = useState('');
  const [offlineAmount, setOfflineAmount] = useState('');
  const [submittingOffline, setSubmittingOffline] = useState(false);

  // Donation tiers price by a volunteer-entered amount and the backend's
  // offline endpoint rejects them (as does the card endpoint) — so hide the
  // cash affordance rather than let it 422.
  const hasDonationItem =
    params.kind === 'ticket' && params.items.some((i) => i.donationAmountCents != null);

  const title = params.kind === 'ticket' ? params.eventTitle : params.planName;
  const amountLabel = params.kind === 'ticket' ? params.totalLabel : params.amountLabel;

  // While the terminal SDK is actively connecting/collecting/processing, its own
  // step takes precedence; otherwise we're between API calls (preparing the
  // intent, finalizing the membership subscription) or at a terminal state.
  const phase =
    localPhase === 'preparing' &&
    (collector.step === 'connecting' ||
      collector.step === 'collecting' ||
      collector.step === 'processing')
      ? collector.step
      : localPhase;

  const run = useCallback(async () => {
    if (offlineTakeoverRef.current) return;
    const attempt = ++attemptRef.current;
    const stale = () => offlineTakeoverRef.current || attemptRef.current !== attempt;
    const testCard = TEST_CARDS.find((c) => c.id === testCardIdRef.current) ?? DEFAULT_TEST_CARD;
    setErrorKind('other');

    try {
      if (params.kind === 'ticket') {
        const tiers: Record<string, number> = {};
        for (const item of params.items) {
          // A donation tier's map value is read by the backend as an amount in
          // cents; every other tier's value is a ticket quantity.
          tiers[item.ticketTierId] = item.donationAmountCents ?? item.quantity;
        }

        const intent = await api.createTicketPaymentIntent(params.eventId, {
          member_id: params.memberId,
          tiers,
        });

        const outcome = await collector.collectPayment(intent.client_secret, testCard.cardNumber);
        if (!outcome.success) {
          setErrorKind(classifyError(outcome));
          throw new Error(outcome.error);
        }
      } else {
        let paymentMethodId = collectedPaymentMethodIdRef.current;

        if (!paymentMethodId) {
          const setupIntent = await api.createMembershipSetupIntent({
            member_id: params.memberId,
          });

          const outcome = await collector.collectSetup(
            setupIntent.client_secret,
            testCard.cardNumber
          );
          if (!outcome.success) {
            setErrorKind(classifyError(outcome));
            throw new Error(outcome.error);
          }

          paymentMethodId = outcome.paymentMethodId;
          collectedPaymentMethodIdRef.current = paymentMethodId;
        }

        setLocalPhase('finalizing');
        await api.subscribeMembership({
          member_id: params.memberId,
          plan: params.planId,
          payment_method_id: paymentMethodId,
        });
      }
      if (stale()) return;
      setLocalPhase('success');
    } catch (err) {
      if (stale()) return;
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Payment failed'
      );
      setLocalPhase('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    const timer = setTimeout(() => void run(), 0);
    return () => clearTimeout(timer);
  }, [run]);

  // Arrived in cash mode via a long-press on the previous screen: open the
  // offline form immediately instead of the (suppressed) card flow.
  const startedOfflineRef = useRef(false);
  useEffect(() => {
    if (!params.startOffline || startedOfflineRef.current) return;
    startedOfflineRef.current = true;
    offlineTakeoverRef.current = true;
    setOfflineMethod('cash');
    setOfflineNote('');
    setOfflineAmount(params.kind === 'ticket' ? amountLabelToInput(params.totalLabel) : '');
    setOfflineOpen(true);
  }, [params]);

  // A short buzz on the outcome so a volunteer at a loud, bright door knows
  // the charge landed (or didn't) without reading the screen. No-ops on web.
  useEffect(() => {
    if (phase === 'success') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else if (phase === 'error') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  }, [phase]);

  function retry() {
    setError(null);
    setErrorKind('other');
    setLocalPhase('preparing');
    // An offline submission that failed retries as another offline attempt —
    // the card reader was already taken out of the flow.
    if (offlineTakeoverRef.current) {
      setOfflineOpen(true);
      return;
    }
    void run();
  }

  function openOfflineForm() {
    offlineTakeoverRef.current = true;
    // Invalidate any in-flight card attempt so a late outcome can't land.
    attemptRef.current += 1;
    collector.reset();
    setError(null);
    setErrorKind('other');
    setOfflineMethod('cash');
    setOfflineNote('');
    setOfflineAmount(params.kind === 'ticket' ? amountLabelToInput(params.totalLabel) : '');
    setLocalPhase('preparing');
    setOfflineOpen(true);
  }

  // Backing out of the offline form hands the sale back to the card reader.
  // Ignored while a submission is in flight (incl. the Android hardware Back
  // button via the Modal's onRequestClose) so we can't start a card charge
  // for a sale that may be getting recorded offline right now.
  function cancelOffline() {
    if (submittingOffline) return;
    setOfflineOpen(false);
    offlineTakeoverRef.current = false;
    setLocalPhase('preparing');
    void run();
  }

  async function submitOffline() {
    setSubmittingOffline(true);
    setError(null);
    const note = offlineNote.trim();
    try {
      if (params.kind === 'ticket') {
        const tiers: Record<string, number> = {};
        for (const item of params.items) {
          tiers[item.ticketTierId] = item.donationAmountCents ?? item.quantity;
        }
        const cents = dollarsToCents(offlineAmount);
        await api.recordOfflineTicketOrder(params.eventId, {
          member_id: params.memberId,
          tiers,
          payment_method: offlineMethod,
          ...(cents != null ? { amount_collected_cents: cents } : {}),
          ...(note ? { note } : {}),
        });
      } else {
        await api.subscribeOfflineMembership({
          member_id: params.memberId,
          plan: params.planId,
          payment_method: offlineMethod,
          ...(note ? { note } : {}),
        });
      }
      setOfflineOpen(false);
      setLocalPhase('success');
    } catch (err) {
      setErrorKind('other');
      setError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Could not record the payment'
      );
      setOfflineOpen(false);
      setLocalPhase('error');
    } finally {
      setSubmittingOffline(false);
    }
  }

  // Door-sale flow: a ticket seller works one event at a time, charging one
  // person after another — so success sends them back to a fresh member
  // search for the *same* event instead of all the way to Home. A membership
  // that was only a detour on the way to buying tickets (`resumeTicket`)
  // resumes that ticket purchase; a plain membership sign-up goes Home.
  function handleDone() {
    if (params.kind === 'ticket') {
      navigation.popToTop();
      navigation.navigate('MemberSearch', {
        purpose: 'ticket',
        eventId: params.eventId,
        eventTitle: params.eventTitle,
      });
      return;
    }

    if (params.resumeTicket) {
      navigation.popToTop();
      navigation.navigate('EventTicketQuantities', {
        eventId: params.resumeTicket.eventId,
        eventTitle: params.resumeTicket.eventTitle,
        memberId: params.memberId,
        memberName: params.memberName,
      });
      return;
    }

    navigation.popToTop();
  }

  const successLabel =
    params.kind === 'ticket'
      ? 'Sell another ticket'
      : params.resumeTicket
        ? 'Continue to tickets'
        : 'Done';

  // Full-bleed outcome screens: a volunteer at a loud, bright door needs to
  // read the result in a fraction of a second from arm's length, so the whole
  // screen goes green or red with one oversized glyph and large white copy.
  if (phase === 'success') {
    return (
      <View
        className="flex-1 items-center justify-center bg-green-600 px-8"
        style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
        <View className="mb-10 h-44 w-44 items-center justify-center rounded-full bg-white/20">
          <Ionicons name="checkmark-sharp" size={128} color="#ffffff" />
        </View>
        <Text className="text-center text-4xl font-extrabold text-white">
          {params.kind === 'ticket' ? 'Payment successful' : 'Membership activated'}
        </Text>
        <Text className="mt-4 text-center text-3xl font-bold text-white">{amountLabel}</Text>
        <Text className="mt-2 text-center text-xl font-medium text-green-50">{title}</Text>
        {params.memberName ? (
          <Text className="mt-1 text-center text-xl font-medium text-green-50">
            {params.memberName}
          </Text>
        ) : null}
        <TouchableOpacity
          className="mt-14 min-h-[64px] w-full items-center justify-center rounded-2xl bg-white px-8 py-4 active:scale-[0.98]"
          onPress={handleDone}>
          <Text className="text-xl font-bold text-green-700">{successLabel}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View
        className="flex-1 items-center justify-center bg-rose-600 px-8"
        style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }}>
        <View className="mb-10 h-44 w-44 items-center justify-center rounded-full bg-white/20">
          <Ionicons name="close-sharp" size={128} color="#ffffff" />
        </View>
        <Text className="text-center text-4xl font-extrabold text-white">
          {errorKind === 'declined' ? 'Card declined' : 'Payment failed'}
        </Text>
        <Text className="mt-4 text-center text-xl font-semibold text-rose-50">
          {errorKind === 'declined'
            ? (error ?? 'The card was declined.') + ' Ask for another card.'
            : (error ?? 'Something went wrong. Please try again.')}
        </Text>
        <Text className="mt-6 text-center text-lg font-medium text-rose-100">{amountLabel}</Text>
        <TouchableOpacity
          className="mt-14 min-h-[64px] w-full items-center justify-center rounded-2xl bg-white px-8 py-4 active:scale-[0.98]"
          onPress={retry}>
          <Text className="text-xl font-bold text-rose-700">
            {errorKind === 'declined' ? 'Try another card' : 'Try again'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-zinc-50">
      <ScreenHeader
        title={params.kind === 'ticket' ? 'Collect payment' : 'Collect membership'}
        subtitle={params.memberName}
        onBack={() => navigation.goBack()}
      />

      <View className="flex-1 items-center justify-center px-8">
        <View className="mb-6 items-center">
          <Text className="text-base font-semibold text-zinc-900">{title}</Text>
          <Text className="mt-1 text-2xl font-bold text-blue-900">{amountLabel}</Text>
          {params.kind === 'ticket' && (
            <View className="mt-3 items-center">
              {params.items.map((item) => (
                <Text key={item.ticketTierId} className="text-sm text-zinc-500">
                  {item.donationAmountCents != null
                    ? `${item.name} — ${item.unitPriceLabel}`
                    : `${item.quantity}× ${item.name}`}
                </Text>
              ))}
            </View>
          )}
        </View>

        {__DEV__ && (
          <View className="mb-6 items-center">
            <Text className="mb-2 text-xs uppercase tracking-wide text-zinc-400">
              Dev: test card (used on next attempt)
            </Text>
            <View className="flex-row flex-wrap justify-center gap-2">
              {TEST_CARDS.map((card) => (
                <TouchableOpacity
                  key={card.id}
                  className={`rounded-full border px-3 py-1.5 ${
                    testCardId === card.id
                      ? 'border-blue-700 bg-blue-700'
                      : 'border-zinc-200 bg-white'
                  }`}
                  onPress={() => setTestCardId(card.id)}>
                  <Text
                    className={`text-xs font-medium ${
                      testCardId === card.id ? 'text-zinc-100' : 'text-zinc-600'
                    }`}>
                    {card.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {(!offlineOpen || submittingOffline) && (
          <View className="items-center">
            <ActivityIndicator size="large" color="#144993" />
            <Text className="mt-4 text-sm text-zinc-500">
              {submittingOffline ? 'Recording payment…' : PHASE_MESSAGE[phase]}
            </Text>
          </View>
        )}

        {!offlineOpen && !submittingOffline && !hasDonationItem && (
          <TouchableOpacity
            className="mt-10 min-h-[44px] items-center justify-center px-4 py-2"
            onPress={openOfflineForm}>
            <Text className="text-base font-semibold text-blue-700">
              Record cash or check payment
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <Modal visible={offlineOpen} transparent animationType="slide" onRequestClose={cancelOffline}>
        <KeyboardAvoidingView
          className="flex-1 justify-end"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View
            className="rounded-t-3xl bg-white px-6 pt-6"
            style={{ paddingBottom: insets.bottom + 24 }}>
            <Text className="text-xl font-bold text-zinc-900">
              {params.kind === 'ticket'
                ? 'Record cash / check sale'
                : 'Record cash / check membership'}
            </Text>
            <Text className="mt-1 text-sm text-zinc-500">
              {title} · {amountLabel}
            </Text>

            <Text className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Payment method
            </Text>
            <View className="flex-row gap-2">
              {OFFLINE_METHODS.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  className={`min-h-[44px] flex-1 items-center justify-center rounded-xl border ${
                    offlineMethod === m.id
                      ? 'border-blue-700 bg-blue-700'
                      : 'border-zinc-200 bg-white'
                  }`}
                  onPress={() => setOfflineMethod(m.id)}>
                  <Text
                    className={`text-base font-semibold ${
                      offlineMethod === m.id ? 'text-white' : 'text-zinc-700'
                    }`}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {params.kind === 'ticket' && (
              <>
                <Text className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Amount collected
                </Text>
                <View className="flex-row items-center rounded-xl border border-zinc-200 px-3">
                  <Text className="text-lg font-semibold text-zinc-400">$</Text>
                  <TextInput
                    className="ml-1 min-h-[48px] flex-1 text-lg font-semibold text-zinc-900"
                    placeholder="0.00"
                    placeholderTextColor="#d4d4d8"
                    keyboardType="decimal-pad"
                    value={offlineAmount}
                    onChangeText={setOfflineAmount}
                  />
                </View>
              </>
            )}

            <Text className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Note (optional)
            </Text>
            <TextInput
              className="min-h-[48px] rounded-xl border border-zinc-200 px-3 py-2 text-base text-zinc-900"
              placeholder="check #1234, envelope 7…"
              placeholderTextColor="#d4d4d8"
              value={offlineNote}
              onChangeText={setOfflineNote}
            />

            {error && offlineOpen ? (
              <Text className="mt-3 text-sm font-medium text-rose-600">{error}</Text>
            ) : null}

            <TouchableOpacity
              className="mt-6 min-h-[56px] items-center justify-center rounded bg-blue-700 px-8 py-4 active:scale-[0.98]"
              style={{ opacity: submittingOffline ? 0.8 : 1 }}
              disabled={submittingOffline}
              onPress={() => void submitOffline()}>
              {submittingOffline ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-lg font-semibold text-zinc-100">Record payment</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              className="mt-2 min-h-[44px] items-center justify-center px-4 py-2"
              disabled={submittingOffline}
              onPress={cancelOffline}>
              <Text className="text-base font-medium text-zinc-500">Back to card</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
