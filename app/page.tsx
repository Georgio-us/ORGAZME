"use client";

import {
  ArrowLeft,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  CalendarClock,
  Check,
  CheckSquare2,
  ChevronRight,
  CircleAlert,
  CircleStop,
  Clock3,
  Contact,
  House,
  LayoutDashboard,
  Layers3,
  List,
  Monitor,
  Moon,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  StickyNote,
  Sun,
  TrendingUp,
  Undo2,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

type Screen = "home" | "clients" | "client" | "finances" | "directions";
type ClientsView = "dashboard" | "list";
type ClientView = "dashboard" | "events";
type FinanceView = "dashboard" | "list";
type DirectionsView = "dashboard" | "list";
type ClientListPreset = "all" | "active" | "attention";
type ActionType = "event" | "task" | "meeting" | "contact" | "note";
type ProposalState = "pending" | "accepted" | "rejected";
type ThemePreference = "system" | "light" | "dark";

type Client = {
  id: string;
  name: string;
  category: "Активный" | "Потенциальный";
  attention: "overdue" | "attention" | "active" | "calm";
  status: string;
  nextAction: string;
  lastContact: string;
  lastContactDays: number;
  amount: string;
};

type TimelineItem = {
  id: string;
  kind: string;
  title: string;
  detail: string;
  date: string;
  tone: "blue" | "red" | "green" | "gray";
  dueAt?: string | null;
  occurredAt?: string;
  completed?: boolean;
};

type AIProposal = {
  id: string;
  kind:
    | "event"
    | "task"
    | "meeting"
    | "contact"
    | "note"
    | "client_update"
    | "client_create";
  title: string;
  details: string | null;
  clientId: string | null;
  clientRef: string | null;
  dueAt: string | null;
  clientDraft: {
    name: string;
    category: "active" | "potential";
    status: string | null;
    attention: Client["attention"] | null;
    nextAction: string | null;
    amount: string | null;
  } | null;
  clientPatch: {
    status: string | null;
    attention: Client["attention"] | null;
    nextAction: string | null;
    amount: string | null;
  } | null;
  requiresClarification: boolean;
};

type WorkspaceSnapshot = {
  clients: Client[];
  timelines: Record<string, TimelineItem[]>;
};

type AgendaItem = TimelineItem & {
  clientId: string;
  clientName: string;
};

function dateKey(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof value === "string" ? new Date(value) : value);
}

const actionLabels: Record<ActionType, string> = {
  event: "Событие",
  task: "Задача",
  meeting: "Встреча",
  contact: "Контакт",
  note: "Заметка",
};

const actionIcons: Record<ActionType, LucideIcon> = {
  event: Sparkles,
  task: CheckSquare2,
  meeting: CalendarDays,
  contact: Contact,
  note: StickyNote,
};

const indicatorLabels = {
  overdue: "Есть просроченная задача",
  attention: "Требуется внимание",
  active: "Есть активное действие",
  calm: "Нет срочных действий",
};

export default function Home() {
  const [screen, setScreen] = useState<Screen>("home");
  const [clientsView, setClientsView] = useState<ClientsView>("dashboard");
  const [clientView, setClientView] = useState<ClientView>("dashboard");
  const [financeView, setFinanceView] = useState<FinanceView>("dashboard");
  const [directionsView, setDirectionsView] =
    useState<DirectionsView>("dashboard");
  const [clientRecords, setClientRecords] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [timelines, setTimelines] = useState<Record<string, TimelineItem[]>>({});
  const [actionOpen, setActionOpen] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>("system");
  const [clientMenuOpen, setClientMenuOpen] = useState(false);
  const [clientEditOpen, setClientEditOpen] = useState(false);
  const [attentionOpen, setAttentionOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineItem | null>(null);
  const [toast, setToast] = useState("");
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [postponedTasks, setPostponedTasks] = useState<string[]>([]);
  const [voiceIntent, setVoiceIntent] = useState<ActionType | null>(null);
  const [voiceState, setVoiceState] = useState<
    "idle" | "recording" | "processing" | "review" | "error"
  >("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState("");
  const [proposalStates, setProposalStates] = useState<
    Record<string, ProposalState>
  >({});
  const [aiTranscript, setAiTranscript] = useState("");
  const [aiProposalsList, setAiProposalsList] = useState<AIProposal[]>([]);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressTriggered = useRef(false);
  const pointerHeld = useRef(false);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const mediaStream = useRef<MediaStream | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const scopeLabel =
    screen === "home"
      ? "Все направления"
      : screen === "clients"
        ? "Все клиенты"
        : screen === "client"
          ? selectedClient?.name ?? "Клиент"
          : screen === "finances"
            ? "Финансы"
            : "Направления";

  const acceptedProposals = useMemo(
    () =>
      Object.values(proposalStates).filter((state) => state === "accepted")
        .length,
    [proposalStates],
  );

  const agendaItems = useMemo<AgendaItem[]>(() => {
    const clientNames = new Map(
      clientRecords.map((client) => [client.id, client.name]),
    );
    return Object.entries(timelines)
      .flatMap(([clientId, items]) =>
        items.map((item) => ({
          ...item,
          clientId,
          clientName: clientNames.get(clientId) ?? "Клиент",
        })),
      )
      .filter(
        (item) =>
          !item.completed &&
          item.kind !== "Заметка" &&
          Boolean(item.dueAt || item.occurredAt),
      )
      .sort((left, right) => {
        const leftTime = new Date(left.dueAt ?? left.occurredAt ?? 0).getTime();
        const rightTime = new Date(
          right.dueAt ?? right.occurredAt ?? 0,
        ).getTime();
        return leftTime - rightTime;
      });
  }, [clientRecords, timelines]);

  const todayAgenda = useMemo(() => {
    const today = dateKey(new Date());
    return agendaItems.filter((item) => {
      const moment = item.dueAt ?? item.occurredAt;
      return moment ? dateKey(moment) === today : false;
    });
  }, [agendaItems]);

  const overdueTaskCount = useMemo(
    () =>
      agendaItems.filter(
        (item) =>
          item.kind === "Задача" &&
          item.dueAt &&
          item.tone === "red",
      ).length,
    [agendaItems],
  );

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("orgazme-theme");
    if (
      savedTheme === "system" ||
      savedTheme === "light" ||
      savedTheme === "dark"
    ) {
      const frame = window.requestAnimationFrame(() => setTheme(savedTheme));
      return () => window.cancelAnimationFrame(frame);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    fetch("/api/bootstrap", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("live_data_unavailable");
        return (await response.json()) as WorkspaceSnapshot;
      })
      .then((snapshot) => {
        if (!mounted) return;
        setClientRecords(snapshot.clients);
        setTimelines(snapshot.timelines);
        setSelectedClient((current) =>
          snapshot.clients.find((client) => client.id === current?.id) ??
          snapshot.clients[0] ??
          null,
        );
      })
      .catch(() => {
        if (mounted) {
          setToast("Не удалось загрузить данные");
          window.setTimeout(() => setToast(""), 1800);
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const changeTheme = (nextTheme: ThemePreference) => {
    setTheme(nextTheme);
    window.localStorage.setItem("orgazme-theme", nextTheme);
  };

  const goBack = () => {
    if (screen === "client") {
      setScreen("clients");
      setClientView("dashboard");
      return;
    }
    if (screen === "clients") {
      setScreen("home");
      setClientsView("dashboard");
      return;
    }
    setScreen("home");
  };

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 1800);
  };

  const openClient = (client: Client) => {
    setSelectedClient(client);
    setScreen("client");
    setClientView("dashboard");
  };

  const applySnapshot = (snapshot: WorkspaceSnapshot, selectedId?: string) => {
    setClientRecords(snapshot.clients);
    setTimelines(snapshot.timelines);
    const currentId = selectedId ?? selectedClient?.id;
    const current = snapshot.clients.find((client) => client.id === currentId);
    setSelectedClient(current ?? snapshot.clients[0] ?? null);
  };

  const addClient = async (client: Client) => {
    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(client),
      });
      const data = (await response.json()) as { client?: Client; error?: string };
      if (!response.ok || !data.client) {
        throw new Error(data.error || "Не удалось создать клиента.");
      }
      setClientRecords((current) => [data.client!, ...current]);
      setTimelines((current) => ({ ...current, [data.client!.id]: [] }));
      setNewClientOpen(false);
      setSelectedClient(data.client);
      setScreen("client");
      showToast("Клиент сохранён в базе");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка сохранения");
    }
  };

  const updateClient = async (updatedClient: Client) => {
    try {
      const response = await fetch(`/api/clients/${updatedClient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedClient),
      });
      const data = (await response.json()) as { client?: Client; error?: string };
      if (!response.ok || !data.client) {
        throw new Error(data.error || "Не удалось обновить клиента.");
      }
      setClientRecords((current) =>
        current.map((client) =>
          client.id === data.client!.id ? data.client! : client,
        ),
      );
      setSelectedClient(data.client);
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка сохранения");
      return false;
    }
  };

  const updateEvent = async (
    eventId: string,
    patch: Record<string, unknown>,
  ) => {
    try {
      const response = await fetch(`/api/events/${eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await response.json()) as {
        event?: TimelineItem;
        error?: string;
      };
      if (!response.ok || !data.event) {
        throw new Error(data.error || "Не удалось обновить событие.");
      }
      if (!selectedClient) return null;
      setTimelines((current) => ({
        ...current,
        [selectedClient.id]: (current[selectedClient.id] ?? []).map((item) =>
          item.id === eventId ? data.event! : item,
        ),
      }));
      return data.event;
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Ошибка сохранения");
      return null;
    }
  };

  const beginRecording = async (
    intent: ActionType | null,
    requirePointerHold: boolean,
  ) => {
    if (requirePointerHold) longPressTriggered.current = true;
    setVoiceIntent(intent);
    setActionOpen(false);
    setVoiceError("");
    setRecordingSeconds(0);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        throw new Error("Запись голоса не поддерживается этим браузером.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (requirePointerHold && !pointerHeld.current) {
        stream.getTracks().forEach((track) => track.stop());
        setVoiceState("idle");
        setVoiceIntent(null);
        return;
      }
      mediaStream.current = stream;
      const recorder = new MediaRecorder(stream);
      audioChunks.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.current.push(event.data);
      };
      recorder.start();
      mediaRecorder.current = recorder;
      setVoiceState("recording");
      recordingTimer.current = setInterval(
        () => setRecordingSeconds((value) => value + 1),
        1000,
      );
    } catch (error) {
      setVoiceError(
        error instanceof Error
          ? error.message
          : "Не удалось получить доступ к микрофону.",
      );
      setVoiceState("error");
    }
  };

  const startGeneralRecording = () => beginRecording(null, true);

  const startContextualRecording = (type: ActionType) => {
    void beginRecording(type, false);
  };

  const processRecording = async (blob: Blob) => {
    try {
      const formData = new FormData();
      formData.append(
        "audio",
        new File([blob], "orgazme-voice.webm", {
          type: blob.type || "audio/webm",
        }),
      );
      if (voiceIntent) formData.append("intent", voiceIntent);
      if (screen === "client" && selectedClient) {
        formData.append("clientId", selectedClient.id);
      }
      formData.append("durationSeconds", String(recordingSeconds));

      const response = await fetch("/api/ai/ingest", {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as {
        transcript?: string;
        proposals?: AIProposal[];
        error?: string;
      };
      if (!response.ok || !data.transcript || !data.proposals) {
        throw new Error(data.error || "AI не смог обработать запись.");
      }
      setAiTranscript(data.transcript);
      setAiProposalsList(data.proposals);
      setProposalStates(
        Object.fromEntries(
          data.proposals.map((proposal) => [proposal.id, "pending"]),
        ),
      );
      setVoiceState("review");
    } catch (error) {
      setVoiceError(
        error instanceof Error
          ? error.message
          : "Не удалось обработать запись.",
      );
      setVoiceState("error");
    }
  };

  const stopRecording = () => {
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }
    const recorder = mediaRecorder.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = () => {
        mediaStream.current?.getTracks().forEach((track) => track.stop());
        mediaStream.current = null;
        setVoiceState("processing");
        const blob = new Blob(audioChunks.current, {
          type: recorder.mimeType || "audio/webm",
        });
        void processRecording(blob);
      };
      recorder.stop();
      return;
    }
    mediaStream.current?.getTracks().forEach((track) => track.stop());
  };

  const handleActionPointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointerHeld.current = true;
    longPressTriggered.current = false;
    holdTimer.current = setTimeout(startGeneralRecording, 420);
  };

  const handleActionPointerUp = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointerHeld.current = false;
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (longPressTriggered.current) {
      return;
    }
    setActionOpen(true);
  };

  const handleActionPointerCancel = () => {
    pointerHeld.current = false;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const cancelRecording = () => {
    if (recordingTimer.current) clearInterval(recordingTimer.current);
    if (mediaRecorder.current?.state !== "inactive") mediaRecorder.current?.stop();
    mediaStream.current?.getTracks().forEach((track) => track.stop());
    setVoiceState("idle");
    setVoiceIntent(null);
    setAiTranscript("");
    setAiProposalsList([]);
  };

  const setProposal = (id: string, state: ProposalState) => {
    setProposalStates((current) => ({ ...current, [id]: state }));
  };

  const applyProposals = async (editedTitles: Record<string, string>) => {
    try {
      const decisions = aiProposalsList
        .filter((proposal) => proposalStates[proposal.id] !== "pending")
        .map((proposal) => ({
          id: proposal.id,
          status: proposalStates[proposal.id] as "accepted" | "rejected",
          title: editedTitles[proposal.id],
          clientId: proposal.clientId,
        }));
      const response = await fetch("/api/ai/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decisions }),
      });
      const data = (await response.json()) as WorkspaceSnapshot & {
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Ошибка применения");
      applySnapshot(data);
      showToast(
        acceptedProposals > 0
          ? `Сохранено в базе: ${acceptedProposals}`
          : "Предложения обработаны",
      );
      setVoiceState("idle");
      setVoiceIntent(null);
      setProposalStates({});
      setAiTranscript("");
      setAiProposalsList([]);
    } catch (error) {
      setVoiceError(
        error instanceof Error ? error.message : "Не удалось сохранить решения.",
      );
      setVoiceState("error");
    }
  };

  return (
    <main className="app-shell" data-theme={theme}>
      <header className="topbar">
        <div className="topbar-left">
          {screen !== "home" ? (
            <button className="icon-button" onClick={goBack} aria-label="Назад">
              <ArrowLeft size={18} strokeWidth={2.2} />
            </button>
          ) : (
            <span className="brand-mark">
              <span />
            </span>
          )}
          <div>
            <strong>ORGAZME</strong>
            <span>{scopeLabel}</span>
          </div>
        </div>
        <div className="topbar-actions">
          <button
            className="icon-button"
            aria-label="Уведомления"
            onClick={() => setNotificationsOpen(true)}
          >
            <span className="notification-dot" />
            <Bell size={18} strokeWidth={1.9} />
          </button>
          <button
            className="icon-button"
            aria-label="Меню"
            onClick={() => setMenuOpen(true)}
          >
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>

      <section className="workspace">
        {screen === "home" && (
          <HomeScreen
            clientCount={clientRecords.length}
            overdueCount={overdueTaskCount}
            attentionCount={
              clientRecords.filter(
                (client) =>
                  client.attention === "attention" ||
                  client.attention === "overdue",
              ).length
            }
            agenda={agendaItems.slice(0, 3)}
            onOpenAgenda={(item) => {
              const client = clientRecords.find(
                (record) => record.id === item.clientId,
              );
              if (client) openClient(client);
            }}
            onClients={() => setScreen("clients")}
            onFinances={() => setScreen("finances")}
            onDirections={() => setScreen("directions")}
          />
        )}

        {screen === "clients" && (
          <ClientsScreen
            view={clientsView}
            clients={clientRecords}
            todayAgenda={todayAgenda}
            overdueTaskCount={overdueTaskCount}
            onViewChange={setClientsView}
            onOpenClient={openClient}
          />
        )}

        {screen === "client" && selectedClient && (
          <ClientScreen
            client={selectedClient}
            view={clientView}
            onViewChange={setClientView}
            timeline={timelines[selectedClient.id] ?? []}
            taskCompleted={
              completedTasks.includes(selectedClient.id) &&
              !(timelines[selectedClient.id] ?? []).some(
                (item) => item.kind === "Задача" && !item.completed,
              )
            }
            taskPostponed={postponedTasks.includes(selectedClient.id)}
            onCompleteTask={async () => {
              const task = (timelines[selectedClient.id] ?? []).find(
                (item) => item.kind === "Задача" && !item.completed,
              );
              if (!task) return showToast("У клиента нет открытой задачи");
              if (await updateEvent(task.id, { completed: true })) {
                setCompletedTasks((items) => [...items, selectedClient.id]);
                showToast("Задача выполнена и сохранена");
              }
            }}
            onPostponeTask={async () => {
              const task = (timelines[selectedClient.id] ?? []).find(
                (item) => item.kind === "Задача" && !item.completed,
              );
              if (!task) return showToast("У клиента нет открытой задачи");
              const nextDue = new Date();
              nextDue.setDate(nextDue.getDate() + 1);
              nextDue.setHours(12, 0, 0, 0);
              if (
                await updateEvent(task.id, { dueAt: nextDue.toISOString() })
              ) {
                setPostponedTasks((items) => [...items, selectedClient.id]);
                showToast("Задача перенесена и сохранена");
              }
            }}
            onOpenEvents={() => setClientView("events")}
            onOpenMenu={() => setClientMenuOpen(true)}
            onEditEvent={setEditingEvent}
          />
        )}

        {screen === "finances" && (
          <FinanceScreen
            view={financeView}
            onViewChange={setFinanceView}
          />
        )}

        {screen === "directions" && (
          <DirectionsScreen
            view={directionsView}
            onViewChange={setDirectionsView}
          />
        )}
      </section>

      <nav className="tabbar" aria-label="Основная навигация">
        <button
          className={`tab-item ${screen === "home" ? "active" : ""}`}
          onClick={() => setScreen("home")}
        >
          <House size={20} strokeWidth={2} />
          <span>Главная</span>
        </button>
        <button
          className={`tab-item ${screen === "clients" || screen === "client" ? "active" : ""}`}
          onClick={() => setScreen("clients")}
        >
          <Users size={20} strokeWidth={2} />
          <span>Клиенты</span>
        </button>
        <div className="action-slot">
          <button
            className={`action-button ${voiceState === "recording" ? "is-recording" : ""}`}
            onPointerDown={handleActionPointerDown}
            onPointerUp={handleActionPointerUp}
            onPointerCancel={handleActionPointerCancel}
            onContextMenu={(event) => event.preventDefault()}
            aria-label="Действие: нажать для выбора, удерживать для записи"
          >
            {voiceState === "recording" ? (
              <CircleStop size={24} fill="currentColor" />
            ) : (
              <Plus size={27} strokeWidth={2.2} />
            )}
          </button>
        </div>
        <button
          className={`tab-item ${screen === "finances" ? "active" : ""}`}
          onClick={() => setScreen("finances")}
        >
          <WalletCards size={20} strokeWidth={2} />
          <span>Финансы</span>
        </button>
        <button
          className={`tab-item ${screen === "directions" ? "active" : ""}`}
          onClick={() => setScreen("directions")}
        >
          <Layers3 size={20} strokeWidth={2} />
          <span>Проекты</span>
        </button>
      </nav>

      {actionOpen && (
        <div className="overlay" onClick={() => setActionOpen(false)}>
          <section
            className="bottom-sheet action-sheet"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" />
            <div className="sheet-heading">
              <div>
                <span className="eyebrow">Контекст</span>
                <h2>{scopeLabel}</h2>
              </div>
              <button
                className="close-button"
                onClick={() => setActionOpen(false)}
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </div>
            <p className="sheet-description">
              Выберите тип — голосовая запись начнётся сразу.
            </p>
            <div className="action-grid">
              {(Object.keys(actionLabels) as ActionType[]).map((type) => (
                <ActionChoice
                  key={type}
                  type={type}
                  onClick={() => startContextualRecording(type)}
                />
              ))}
              {screen !== "client" && (
                <button
                  className="action-choice action-choice-wide"
                  onClick={() => {
                    setActionOpen(false);
                    setNewClientOpen(true);
                  }}
                >
                  <span><Plus size={17} /></span>
                  Новый клиент
                  <ChevronRight size={16} className="choice-chevron" />
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {voiceState !== "idle" && (
        <VoiceOverlay
          state={voiceState}
          seconds={recordingSeconds}
          error={voiceError}
          scope={scopeLabel}
          intent={voiceIntent}
          proposals={proposalStates}
          transcript={aiTranscript}
          proposalCards={aiProposalsList}
          clients={clientRecords}
          onProposal={setProposal}
          onAssignClient={(proposalId, clientId) => {
            setAiProposalsList((current) =>
              current.map((proposal) =>
                proposal.id === proposalId
                  ? { ...proposal, clientId }
                  : proposal,
              ),
            );
          }}
          onCancel={cancelRecording}
          onStop={stopRecording}
          onRetry={() => {
            setVoiceState("idle");
            setVoiceIntent(null);
          }}
          onApply={applyProposals}
        />
      )}

      {newClientOpen && (
        <NewClientSheet
          onClose={() => setNewClientOpen(false)}
          onSave={addClient}
        />
      )}

      {notificationsOpen && (
        <NotificationsSheet
          items={agendaItems.slice(0, 3)}
          onClose={() => setNotificationsOpen(false)}
          onOpenClient={(clientKey) => {
            const client = clientRecords.find(
              (item) => item.id === clientKey || item.name === clientKey,
            );
            if (client) openClient(client);
            setNotificationsOpen(false);
          }}
        />
      )}

      {menuOpen && (
        <MainMenuSheet
          onClose={() => setMenuOpen(false)}
          onOpenSettings={() => {
            setMenuOpen(false);
            setSettingsOpen(true);
          }}
          onSelect={(label) => {
            setMenuOpen(false);
            showToast(`${label}: раздел открыт`);
          }}
        />
      )}

      {settingsOpen && (
        <InterfaceSettingsSheet
          theme={theme}
          onThemeChange={changeTheme}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {clientMenuOpen && selectedClient && (
        <ClientMenuSheet
          client={selectedClient}
          onClose={() => setClientMenuOpen(false)}
          onEdit={() => {
            setClientMenuOpen(false);
            setClientEditOpen(true);
          }}
          onAttention={() => {
            setClientMenuOpen(false);
            setAttentionOpen(true);
          }}
          onCopy={async () => {
            const cardText = `${selectedClient.name}\n${selectedClient.status}\nСледующее: ${selectedClient.nextAction}\n${selectedClient.amount}`;
            try {
              await navigator.clipboard.writeText(cardText);
              showToast("Карточка скопирована");
            } catch {
              showToast("Не удалось скопировать карточку");
            }
            setClientMenuOpen(false);
          }}
        />
      )}

      {clientEditOpen && selectedClient && (
        <ClientEditSheet
          client={selectedClient}
          onClose={() => setClientEditOpen(false)}
          onSave={(updatedClient) => {
            void updateClient(updatedClient).then((saved) => {
              if (!saved) return;
              setClientEditOpen(false);
              showToast("Карточка клиента обновлена в базе");
            });
          }}
        />
      )}

      {attentionOpen && selectedClient && (
        <AttentionSheet
          client={selectedClient}
          onClose={() => setAttentionOpen(false)}
          onSelect={(attention) => {
            void updateClient({ ...selectedClient, attention }).then((saved) => {
              if (!saved) return;
              setAttentionOpen(false);
              showToast("Уровень внимания сохранён");
            });
          }}
        />
      )}

      {editingEvent && (
        <EventEditSheet
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSave={(updatedEvent) => {
            void updateEvent(updatedEvent.id, {
              title: updatedEvent.title,
              details: updatedEvent.detail,
            }).then((saved) => {
              if (!saved) return;
              setEditingEvent(null);
              showToast("Событие обновлено в базе");
            });
          }}
        />
      )}

      {toast && <div className="toast-message">{toast}</div>}
    </main>
  );
}

function ActionChoice({
  type,
  onClick,
}: {
  type: ActionType;
  onClick: () => void;
}) {
  const Icon = actionIcons[type];

  return (
    <button className="action-choice" onClick={onClick}>
      <span><Icon size={17} strokeWidth={2} /></span>
      {actionLabels[type]}
      <ChevronRight size={16} className="choice-chevron" />
    </button>
  );
}

function HomeScreen({
  clientCount,
  overdueCount,
  attentionCount,
  agenda,
  onOpenAgenda,
  onClients,
  onFinances,
  onDirections,
}: {
  clientCount: number;
  overdueCount: number;
  attentionCount: number;
  agenda: AgendaItem[];
  onOpenAgenda: (item: AgendaItem) => void;
  onClients: () => void;
  onFinances: () => void;
  onDirections: () => void;
}) {
  const dateLabel = new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Madrid",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
  return (
    <div className="screen home-screen">
      <div className="screen-intro">
        <span className="eyebrow">{dateLabel}</span>
        <h1>Добрый день</h1>
        <p>Вот что сейчас происходит в вашем бизнесе.</p>
      </div>

      <div className="direction-list">
        <button className="direction-card clients-card" onClick={onClients}>
          <div className="direction-topline">
            <span className="direction-icon"><Users size={19} /></span>
            <ChevronRight size={18} className="direction-arrow" />
          </div>
          <div>
            <h2>Клиенты</h2>
            <p>{clientCount} клиентов в контексте</p>
          </div>
          <div className="direction-summary">
            <span><i className="summary-dot danger-dot" />{overdueCount} просрочено</span>
            <span><i className="summary-dot warn-dot" />{attentionCount} ждёт внимания</span>
          </div>
        </button>

        <button
          className="direction-card finance-card"
          onClick={onFinances}
        >
          <div className="direction-topline">
            <span className="direction-icon finance-icon"><WalletCards size={19} /></span>
            <ChevronRight size={17} className="card-chevron" />
          </div>
          <div>
            <h2>Финансы</h2>
            <p>Факт · план · возможности</p>
          </div>
        </button>

        <button
          className="direction-card directions-card"
          onClick={onDirections}
        >
          <div className="direction-topline">
            <span className="direction-icon projects-icon"><Layers3 size={19} /></span>
            <ChevronRight size={17} className="card-chevron" />
          </div>
          <div>
            <h2>Направления</h2>
            <p>Проекты, развитие и идеи</p>
          </div>
        </button>
      </div>

      <section className="home-agenda">
        <div className="home-agenda-head">
          <div>
            <span className="eyebrow">Общий контекст</span>
            <h2>Сейчас</h2>
          </div>
          <span className="agenda-count">{agenda.length}</span>
        </div>
        {agenda.length === 0 ? (
          <div className="home-agenda-empty">
            <strong>Пока ничего не запланировано</strong>
            <p>Здесь появятся задачи, встречи и важные действия.</p>
          </div>
        ) : (
          agenda.map((item) => {
            const Icon =
              item.kind === "Встреча"
                ? CalendarClock
                : item.tone === "red"
                  ? CircleAlert
                  : Sparkles;
            const iconTone =
              item.tone === "red"
                ? "agenda-danger"
                : item.kind === "Встреча"
                  ? "agenda-blue"
                  : "agenda-purple";
            return (
              <button
                className="agenda-row"
                key={item.id}
                onClick={() => onOpenAgenda(item)}
              >
                <span className={`agenda-icon ${iconTone}`}>
                  <Icon size={16} />
                </span>
                <span className="agenda-copy">
                  <strong>{item.title}</strong>
                  <small>{item.clientName} · {item.date}</small>
                </span>
                <ChevronRight size={15} />
              </button>
            );
          })
        )}
      </section>
    </div>
  );
}

function FinanceScreen({
  view,
  onViewChange,
}: {
  view: FinanceView;
  onViewChange: (view: FinanceView) => void;
}) {
  return (
    <div className="screen finance-screen">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Направление</span>
          <h1>Финансы</h1>
        </div>
        <ViewToggle
          active={view}
          left="dashboard"
          right="list"
          onChange={onViewChange}
        />
      </div>

      {view === "dashboard" ? (
        <>
          <section className="balance-card">
            <div className="balance-head">
              <span>Финансовый контекст</span>
              <TrendingUp size={18} />
            </div>
            <strong>€0</strong>
            <small>Данных пока нет</small>
            <div className="balance-progress"><span style={{ width: "0%" }} /></div>
          </section>
          <div className="finance-metrics">
            <article>
              <span>Получено</span>
              <strong>€0</strong>
              <small>0 платежей</small>
            </article>
            <article>
              <span>Ожидается</span>
              <strong>€0</strong>
              <small>0 платежей</small>
            </article>
          </div>
          <section className="finance-context-card">
            <div className="panel-title">
              <div>
                <span className="eyebrow">Контекст</span>
                <h2>Требует решения</h2>
              </div>
              <span className="count-pill">0</span>
            </div>
            <div className="empty-panel-state">
              <span className="agenda-icon agenda-blue">
                <WalletCards size={16} />
              </span>
              <div>
                <strong>Финансовых решений пока нет</strong>
                <p>Платежи и обязательства появятся после добавления данных.</p>
              </div>
            </div>
          </section>
        </>
      ) : (
        <div className="transaction-list">
          <div className="list-summary">
            <span>Последние операции</span>
            <strong>0</strong>
          </div>
          <div className="empty-state">
            <WalletCards size={22} />
            <strong>Операций пока нет</strong>
            <span>Здесь будет отображаться финансовая история.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function DirectionsScreen({
  view,
  onViewChange,
}: {
  view: DirectionsView;
  onViewChange: (view: DirectionsView) => void;
}) {
  return (
    <div className="screen directions-screen">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Направление</span>
          <h1>Проекты</h1>
        </div>
        <ViewToggle
          active={view}
          left="dashboard"
          right="list"
          onChange={onViewChange}
        />
      </div>

      {view === "dashboard" ? (
        <>
          <div className="metric-grid direction-metrics">
            <article className="metric-card metric-primary">
              <span>Активные</span>
              <strong>0</strong>
              <small>направления</small>
            </article>
            <article className="metric-card">
              <span>В фокусе</span>
              <strong>0</strong>
              <small>направлений</small>
            </article>
            <article className="metric-card">
              <span>Идей</span>
              <strong>0</strong>
              <small>в бэклоге</small>
            </article>
          </div>
          <section className="focus-card">
            <span className="eyebrow">Главный фокус</span>
            <div className="focus-title">
              <span className="direction-icon projects-icon">
                <BriefcaseBusiness size={18} />
              </span>
              <div>
                <h2>Фокус не выбран</h2>
                <p>Добавьте первое направление</p>
              </div>
            </div>
            <div className="focus-progress"><span style={{ width: "0%" }} /></div>
            <strong>Здесь появится следующее действие по направлению</strong>
          </section>
        </>
      ) : (
        <div className="direction-project-list">
          <div className="empty-state">
            <Layers3 size={22} />
            <strong>Направлений пока нет</strong>
            <span>Здесь будут отображаться проекты, идеи и развитие.</span>
          </div>
        </div>
      )}
    </div>
  );
}

function ClientsScreen({
  view,
  clients,
  todayAgenda,
  overdueTaskCount,
  onViewChange,
  onOpenClient,
}: {
  view: ClientsView;
  clients: Client[];
  todayAgenda: AgendaItem[];
  overdueTaskCount: number;
  onViewChange: (view: ClientsView) => void;
  onOpenClient: (client: Client) => void;
}) {
  const [listPreset, setListPreset] = useState<ClientListPreset>("all");
  const [todayOpen, setTodayOpen] = useState(false);
  const openList = (preset: ClientListPreset) => {
    setListPreset(preset);
    onViewChange("list");
  };

  return (
    <>
      <div className="screen clients-screen">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Направление</span>
            <h1>Клиенты</h1>
          </div>
          <ViewToggle
            active={view}
            left="dashboard"
            right="list"
            onChange={(nextView) => {
              if (nextView === "list") setListPreset("all");
              onViewChange(nextView);
            }}
          />
        </div>

        {view === "dashboard" ? (
          <ClientsDashboard
            clients={clients}
            todayAgenda={todayAgenda}
            overdueTaskCount={overdueTaskCount}
            onOpenClient={onOpenClient}
            onShowActive={() => openList("active")}
            onShowAttention={() => openList("attention")}
            onShowToday={() => setTodayOpen(true)}
          />
        ) : (
          <ClientsList
            clients={clients}
            preset={listPreset}
            onOpenClient={onOpenClient}
          />
        )}
      </div>
      {todayOpen && (
        <TodayActionsSheet
          clients={clients}
          actions={todayAgenda}
          onClose={() => setTodayOpen(false)}
          onOpenClient={(client) => {
            setTodayOpen(false);
            onOpenClient(client);
          }}
        />
      )}
    </>
  );
}

function ClientsDashboard({
  clients,
  todayAgenda,
  overdueTaskCount,
  onOpenClient,
  onShowActive,
  onShowAttention,
  onShowToday,
}: {
  clients: Client[];
  todayAgenda: AgendaItem[];
  overdueTaskCount: number;
  onOpenClient: (client: Client) => void;
  onShowActive: () => void;
  onShowAttention: () => void;
  onShowToday: () => void;
}) {
  const attentionCount = clients.filter(
    (client) =>
      client.attention === "overdue" || client.attention === "attention",
  ).length;
  return (
    <>
      <div className="metric-grid">
        <button
          className="metric-card metric-primary"
          onClick={onShowActive}
        >
          <span>Активные</span>
          <strong>{clients.filter((client) => client.category === "Активный").length}</strong>
          <small>из {clients.length} клиентов</small>
        </button>
        <button className="metric-card" onClick={onShowAttention}>
          <span>Просрочено</span>
          <strong className="danger-text">{overdueTaskCount}</strong>
          <small>задач</small>
        </button>
        <button className="metric-card" onClick={onShowToday}>
          <span>Сегодня</span>
          <strong>{todayAgenda.length}</strong>
          <small>действий</small>
        </button>
      </div>

      <section className="attention-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Приоритет</span>
            <h2>Требуют внимания</h2>
          </div>
          <span className="count-pill">{attentionCount}</span>
        </div>
        {attentionCount === 0 ? (
          <div className="empty-panel-state">
            <span className="agenda-icon agenda-danger">
              <CircleAlert size={16} />
            </span>
            <div>
              <strong>Никто не требует внимания</strong>
              <p>Здесь появятся клиенты с высоким приоритетом.</p>
            </div>
          </div>
        ) : (
          clients
            .filter(
              (client) =>
                client.attention === "overdue" ||
                client.attention === "attention",
            )
            .slice(0, 3)
            .map((client) => (
              <button
                key={client.id}
                className="attention-row"
                onClick={() => onOpenClient(client)}
              >
                <span className={`attention-indicator ${client.attention}`} />
                <span className="attention-copy">
                  <strong>{client.name}</strong>
                  <small>{client.nextAction}</small>
                </span>
                <span className="attention-time">{client.lastContact}</span>
              </button>
            ))
        )}
      </section>

      <section className="today-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Текущая дата</span>
            <h2>Сегодня</h2>
          </div>
        </div>
        {todayAgenda.length === 0 ? (
          <div className="empty-panel-state">
            <span className="agenda-icon agenda-blue">
              <CalendarClock size={16} />
            </span>
            <div>
              <strong>На сегодня действий нет</strong>
              <p>Задачи и встречи появятся здесь автоматически.</p>
            </div>
          </div>
        ) : (
          todayAgenda.slice(0, 3).map((item) => {
            const client = clients.find(
              (record) => record.id === item.clientId,
            );
            return (
              <button
                className="today-line"
                key={item.id}
                onClick={() => client && onOpenClient(client)}
              >
                <time>
                  {item.dueAt
                    ? new Intl.DateTimeFormat("ru-RU", {
                        timeStyle: "short",
                        timeZone: "Europe/Madrid",
                      }).format(new Date(item.dueAt))
                    : "—"}
                </time>
                <span className={`timeline-pin ${item.tone}`} />
                <div>
                  <strong>{item.title}</strong>
                  <small>{item.clientName}</small>
                </div>
                <ChevronRight size={14} />
              </button>
            );
          })
        )}
      </section>
    </>
  );
}

function ClientsList({
  clients,
  preset,
  onOpenClient,
}: {
  clients: Client[];
  preset: ClientListPreset;
  onOpenClient: (client: Client) => void;
}) {
  const [query, setQuery] = useState("");
  const [attentionOnly, setAttentionOnly] = useState(preset === "attention");
  const [activeOnly, setActiveOnly] = useState(preset === "active");
  const [sortBy, setSortBy] = useState<"attention" | "name">("attention");
  const filteredClients = clients
    .filter((client) =>
      client.name.toLowerCase().includes(query.trim().toLowerCase()),
    )
    .filter((client) =>
      attentionOnly
        ? client.attention === "overdue" || client.attention === "attention"
        : true,
    )
    .filter((client) => (activeOnly ? client.category === "Активный" : true))
    .sort((a, b) =>
      sortBy === "name"
        ? a.name.localeCompare(b.name, "ru")
        : attentionRank(a.attention) - attentionRank(b.attention),
    );

  return (
    <div className="client-list">
      <div className="client-tools">
        <label className="search-field">
          <Search size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Найти клиента"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Очистить поиск">
              <X size={13} />
            </button>
          )}
        </label>
        <div className="filter-row">
          <button
            className={activeOnly ? "filter-chip active" : "filter-chip"}
            onClick={() => setActiveOnly((value) => !value)}
          >
            <Users size={12} />
            Активные
          </button>
          <button
            className={attentionOnly ? "filter-chip active" : "filter-chip"}
            onClick={() => setAttentionOnly((value) => !value)}
          >
            <SlidersHorizontal size={12} />
            Требуют внимания
          </button>
          <button
            className="filter-chip"
            onClick={() =>
              setSortBy((value) => (value === "attention" ? "name" : "attention"))
            }
          >
            {sortBy === "attention" ? "По приоритету" : "По имени"}
          </button>
        </div>
      </div>
      <div className="list-summary">
        <span>
          {attentionOnly
            ? "Требующие внимания"
            : activeOnly
              ? "Активные клиенты"
              : "Сначала требующие внимания"}
        </span>
        <strong>{filteredClients.length} клиентов</strong>
      </div>
      {filteredClients.map((client) => (
        <button
          className="client-card"
          key={client.id}
          onClick={() => onOpenClient(client)}
        >
          <div className="client-card-head">
            <div>
              <h2>{client.name}</h2>
              <span>
                {client.category} · {client.status}
              </span>
            </div>
            <span
              className={`client-indicator ${client.attention}`}
              title={indicatorLabels[client.attention]}
            />
          </div>
          <div className="client-next">
            <span>Следующее</span>
            <strong>{client.nextAction}</strong>
          </div>
          <div className="client-card-foot">
            <span>Контакт: {client.lastContact}</span>
            <span>{client.amount}</span>
          </div>
        </button>
      ))}
      {filteredClients.length === 0 && (
        <div className="empty-state">
          {clients.length === 0 ? <Users size={22} /> : <Search size={22} />}
          <strong>
            {clients.length === 0 ? "Клиентов пока нет" : "Ничего не найдено"}
          </strong>
          <span>
            {clients.length === 0
              ? "Создайте первого клиента через центральную action-кнопку."
              : "Измените запрос или отключите фильтр."}
          </span>
        </div>
      )}
    </div>
  );
}

function attentionRank(attention: Client["attention"]) {
  return { overdue: 0, attention: 1, active: 2, calm: 3 }[attention];
}

function ClientScreen({
  client,
  view,
  onViewChange,
  timeline,
  taskCompleted,
  taskPostponed,
  onCompleteTask,
  onPostponeTask,
  onOpenEvents,
  onOpenMenu,
  onEditEvent,
}: {
  client: Client;
  view: ClientView;
  onViewChange: (view: ClientView) => void;
  timeline: TimelineItem[];
  taskCompleted: boolean;
  taskPostponed: boolean;
  onCompleteTask: () => void;
  onPostponeTask: () => void;
  onOpenEvents: () => void;
  onOpenMenu: () => void;
  onEditEvent: (event: TimelineItem) => void;
}) {
  return (
    <div className="screen client-screen">
      <div className="client-title">
        <div>
          <span className="eyebrow">{client.category}</span>
          <h1>{client.name}</h1>
          <p>
            <span className={`inline-dot ${client.attention}`} />
            {client.status}
          </p>
        </div>
        <button
          className="more-button"
          aria-label="Действия клиента"
          onClick={onOpenMenu}
        >
          <MoreHorizontal size={21} />
        </button>
      </div>

      <ViewToggle
        active={view}
        left="dashboard"
        right="events"
        onChange={onViewChange}
        wide
      />

      {view === "dashboard" ? (
        <ClientDashboard
          client={client}
          timeline={timeline}
          taskCompleted={taskCompleted}
          taskPostponed={taskPostponed}
          onCompleteTask={onCompleteTask}
          onPostponeTask={onPostponeTask}
          onOpenEvents={onOpenEvents}
        />
      ) : (
        <ClientTimeline timeline={timeline} onEditEvent={onEditEvent} />
      )}
    </div>
  );
}

function ClientDashboard({
  client,
  timeline,
  taskCompleted,
  taskPostponed,
  onCompleteTask,
  onPostponeTask,
  onOpenEvents,
}: {
  client: Client;
  timeline: TimelineItem[];
  taskCompleted: boolean;
  taskPostponed: boolean;
  onCompleteTask: () => void;
  onPostponeTask: () => void;
  onOpenEvents: () => void;
}) {
  const attentionCopy: Record<
    Client["attention"],
    { label: string; level: string }
  > = {
    overdue: {
      label: "Просрочено",
      level: "Высокий",
    },
    attention: {
      label: "Требует внимания",
      level: "Повышенный",
    },
    active: {
      label: "Активно",
      level: "Рабочий",
    },
    calm: {
      label: "Без срочности",
      level: "Спокойный",
    },
  };
  const attentionState = attentionCopy[client.attention];
  const currentTask = timeline.find(
    (item) => item.kind === "Задача" && !item.completed,
  );
  const nextMeeting = timeline.find(
    (item) => item.kind === "Встреча" && !item.completed,
  );
  const lastContact = timeline.find((item) => item.kind === "Контакт");
  const taskClass = taskCompleted
    ? "task-completed"
    : taskPostponed
      ? "task-postponed"
      : `task-${client.attention}`;

  return (
    <div className="client-dashboard">
      <section className={`current-task-card ${taskClass}`}>
        <div className="task-label">
          <span>Текущая задача</span>
          <span
            className={
              taskCompleted
                ? "complete-pill"
                : taskPostponed
                  ? "postponed-pill"
                  : `task-status-pill ${client.attention}`
            }
          >
            {!currentTask
              ? "Нет"
              : taskCompleted
              ? "Выполнено"
              : taskPostponed
                ? "Перенесено"
                : attentionState.label}
          </span>
        </div>
        <h2>{currentTask?.title ?? "Текущей задачи нет"}</h2>
        <p>
          {!currentTask
            ? "Создайте задачу голосом или через action-кнопку"
            : taskCompleted
            ? "Завершено только что"
            : taskPostponed
              ? `Новый срок: ${currentTask.date}`
              : currentTask.date}
        </p>
        {currentTask && !taskCompleted && (
          <div className="task-actions">
            <button onClick={onCompleteTask}>Выполнено</button>
            <button onClick={onPostponeTask}>Перенести</button>
          </div>
        )}
      </section>

      <div className="info-grid">
        <article className="info-card">
          <span>Последний контакт</span>
          <strong>{client.lastContact}</strong>
          <small>{lastContact?.title ?? "Контактов пока нет"}</small>
        </article>
        <article className="info-card">
          <span>Ближайшая встреча</span>
          <strong>{nextMeeting ? nextMeeting.date : "Нет"}</strong>
          <small>
            {nextMeeting?.title ?? "Запланированных встреч пока нет"}
          </small>
        </article>
        <article className="info-card">
          <span>Финансовый контекст</span>
          <strong>{client.amount}</strong>
          <small>Рабочая оценка</small>
        </article>
        <article className="info-card">
          <span>Уровень внимания</span>
          <strong>{attentionState.level}</strong>
          <small>Можно изменить вручную</small>
        </article>
      </div>

      <section className="summary-card">
        <span className="eyebrow">Подтверждённый контекст</span>
        <h2>Коротко о состоянии</h2>
        <p>
          Статус: {client.status.toLowerCase()}. Последний контакт —{" "}
          {client.lastContact}. Следующее действие: {client.nextAction}.
        </p>
        <button onClick={onOpenEvents}>Открыть события →</button>
      </section>
    </div>
  );
}

function ClientTimeline({
  timeline,
  onEditEvent,
}: {
  timeline: TimelineItem[];
  onEditEvent: (event: TimelineItem) => void;
}) {
  return (
    <div className="timeline-list">
      <div className="list-summary">
        <span>Подтверждённая история</span>
        <strong>{timeline.length} событий</strong>
      </div>
      {timeline.length === 0 && (
        <div className="empty-state">
          <Clock3 size={22} />
          <strong>История пока пуста</strong>
          <span>Подтверждённые события появятся здесь.</span>
        </div>
      )}
      {timeline.map((item) => (
        <article className="timeline-item" key={item.id}>
          <span className={`timeline-marker ${item.tone}`} />
          <div>
            <div className="timeline-meta">
              <span>{item.kind}</span>
              <time>{item.date}</time>
            </div>
            <h2>{item.title}</h2>
            <p>{item.detail}</p>
          </div>
          <button
            aria-label="Редактировать событие"
            onClick={() => onEditEvent(item)}
          >
            <MoreHorizontal size={16} />
          </button>
        </article>
      ))}
    </div>
  );
}

function ViewToggle<
  T extends "dashboard" | "list" | "events",
  U extends "dashboard" | "list" | "events",
>({
  active,
  left,
  right,
  onChange,
  wide = false,
}: {
  active: T | U;
  left: T;
  right: U;
  onChange: (view: T | U) => void;
  wide?: boolean;
}) {
  const labels = {
    dashboard: "Dashboard",
    list: "List",
    events: "События",
  };
  return (
    <div className={`view-toggle ${wide ? "view-toggle-wide" : ""}`}>
      <button
        className={active === left ? "active" : ""}
        onClick={() => onChange(left)}
      >
        {left === "dashboard" && <LayoutDashboard size={13} />}
        {labels[left]}
      </button>
      <button
        className={active === right ? "active" : ""}
        onClick={() => onChange(right)}
      >
        {right === "list" && <List size={13} />}
        {right === "events" && <Clock3 size={13} />}
        {labels[right]}
      </button>
    </div>
  );
}

function TodayActionsSheet({
  clients,
  actions,
  onClose,
  onOpenClient,
}: {
  clients: Client[];
  actions: AgendaItem[];
  onClose: () => void;
  onOpenClient: (client: Client) => void;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <section className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <div>
            <span className="eyebrow">Текущая дата</span>
            <h2>Действия сегодня</h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <div className="notification-list">
          {actions.length === 0 ? (
            <div className="empty-context">
              <span className="agenda-icon agenda-blue">
                <CalendarClock size={16} />
              </span>
              <strong>На сегодня ничего нет</strong>
              <p>Новые задачи и встречи появятся здесь.</p>
            </div>
          ) : (
            actions.map((item) => {
              const client = clients.find(
                (record) => record.id === item.clientId,
              );
              return (
                <button
                  key={item.id}
                  onClick={() => client && onOpenClient(client)}
                >
                  <span
                    className={`agenda-icon ${
                      item.tone === "red" ? "agenda-danger" : "agenda-blue"
                    }`}
                  >
                    {item.kind === "Встреча" ? (
                      <CalendarClock size={16} />
                    ) : (
                      <CircleAlert size={16} />
                    )}
                  </span>
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.clientName} · {item.date}</small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

function EventEditSheet({
  event,
  onClose,
  onSave,
}: {
  event: TimelineItem;
  onClose: () => void;
  onSave: (event: TimelineItem) => void;
}) {
  const [title, setTitle] = useState(event.title);
  const [detail, setDetail] = useState(event.detail);
  const [date, setDate] = useState(event.date);

  return (
    <div className="overlay">
      <section className="bottom-sheet form-sheet">
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <div>
            <span className="eyebrow">{event.kind}</span>
            <h2>Редактировать событие</h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <div className="form-stack">
          <label>
            <span>Название</span>
            <input
              autoFocus
              value={title}
              onChange={(inputEvent) => setTitle(inputEvent.target.value)}
            />
          </label>
          <label>
            <span>Описание</span>
            <textarea
              value={detail}
              onChange={(inputEvent) => setDetail(inputEvent.target.value)}
            />
          </label>
          <label>
            <span>Дата и время</span>
            <input
              value={date}
              onChange={(inputEvent) => setDate(inputEvent.target.value)}
            />
          </label>
        </div>
        <button
          className="primary-button"
          disabled={!title.trim()}
          onClick={() =>
            onSave({
              ...event,
              title: title.trim(),
              detail: detail.trim(),
              date: date.trim(),
            })
          }
        >
          Сохранить изменения
        </button>
      </section>
    </div>
  );
}

function NewClientSheet({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (client: Client) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] =
    useState<Client["category"]>("Потенциальный");
  const [nextAction, setNextAction] = useState("");
  const [amount, setAmount] = useState("");

  const save = () => {
    if (!name.trim()) return;
    onSave({
      id: `client-${Date.now()}`,
      name: name.trim(),
      category,
      attention: nextAction.trim() ? "active" : "calm",
      status: category === "Активный" ? "В работе" : "Первичный контакт",
      nextAction: nextAction.trim() || "Определить следующее действие",
      lastContact: "только что",
      lastContactDays: 0,
      amount: amount.trim() || "Не указано",
    });
  };

  return (
    <div className="overlay">
      <section className="bottom-sheet form-sheet">
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <div>
            <span className="eyebrow">Клиенты</span>
            <h2>Новый клиент</h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <div className="form-stack">
          <label>
            <span>Имя или компания</span>
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Например, Studio North"
            />
          </label>
          <div>
            <span className="form-label">Статус</span>
            <div className="form-segment">
              {(["Потенциальный", "Активный"] as const).map((value) => (
                <button
                  className={category === value ? "active" : ""}
                  key={value}
                  onClick={() => setCategory(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <label>
            <span>Следующее действие</span>
            <input
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
              placeholder="Можно добавить позже"
            />
          </label>
          <label>
            <span>Финансовый контекст</span>
            <input
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="Например, €2 000"
            />
          </label>
        </div>
        <button className="primary-button" disabled={!name.trim()} onClick={save}>
          Создать клиента
        </button>
      </section>
    </div>
  );
}

function NotificationsSheet({
  items,
  onClose,
  onOpenClient,
}: {
  items: AgendaItem[];
  onClose: () => void;
  onOpenClient: (clientId: string) => void;
}) {
  return (
    <div className="overlay" onClick={onClose}>
      <section className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <div>
            <span className="eyebrow">Сегодня</span>
            <h2>Уведомления</h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <div className="notification-list">
          {items.length === 0 ? (
            <div className="empty-context">
              <span className="agenda-icon agenda-purple">
                <Sparkles size={16} />
              </span>
              <strong>Уведомлений пока нет</strong>
              <p>Здесь появятся актуальные задачи и встречи.</p>
            </div>
          ) : (
            items.map((item) => (
              <button
                key={item.id}
                onClick={() => onOpenClient(item.clientId)}
              >
                <span
                  className={`agenda-icon ${
                    item.tone === "red" ? "agenda-danger" : "agenda-blue"
                  }`}
                >
                  {item.kind === "Встреча" ? (
                    <CalendarClock size={16} />
                  ) : (
                    <CircleAlert size={16} />
                  )}
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.clientName} · {item.date}</small>
                </span>
                <ChevronRight size={15} />
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function MainMenuSheet({
  onClose,
  onOpenSettings,
  onSelect,
}: {
  onClose: () => void;
  onOpenSettings: () => void;
  onSelect: (label: string) => void;
}) {
  const items = [
    { label: "Экспорт данных", icon: BriefcaseBusiness },
    { label: "О приложении", icon: CircleAlert },
  ];
  return (
    <div className="overlay" onClick={onClose}>
      <section className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <div><span className="eyebrow">ORGAZME</span><h2>Меню</h2></div>
          <button className="close-button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="action-grid">
          <button className="action-choice" onClick={onOpenSettings}>
            <span><Settings2 size={17} /></span>
            Настройки интерфейса
            <ChevronRight size={16} className="choice-chevron" />
          </button>
          {items.map(({ label, icon: Icon }) => (
            <button className="action-choice" key={label} onClick={() => onSelect(label)}>
              <span><Icon size={17} /></span>
              {label}
              <ChevronRight size={16} className="choice-chevron" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function InterfaceSettingsSheet({
  theme,
  onThemeChange,
  onClose,
}: {
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  onClose: () => void;
}) {
  const options: Array<{
    value: ThemePreference;
    label: string;
    detail: string;
    icon: LucideIcon;
  }> = [
    {
      value: "system",
      label: "Авто",
      detail: "Светлая или тёмная — как на устройстве",
      icon: Monitor,
    },
    {
      value: "light",
      label: "Светлая",
      detail: "Всегда светлое оформление",
      icon: Sun,
    },
    {
      value: "dark",
      label: "Тёмная",
      detail: "Всегда тёмное оформление",
      icon: Moon,
    },
  ];

  return (
    <div className="overlay" onClick={onClose}>
      <section
        className="bottom-sheet settings-sheet"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <div>
            <span className="eyebrow">Внешний вид</span>
            <h2>Настройки интерфейса</h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <div className="theme-options">
          {options.map(({ value, label, detail, icon: Icon }) => (
            <button
              key={value}
              className={`theme-option ${theme === value ? "active" : ""}`}
              onClick={() => onThemeChange(value)}
            >
              <span className="theme-icon"><Icon size={17} /></span>
              <span>
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
              <span className="theme-radio">
                {theme === value && <Check size={13} />}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ClientEditSheet({
  client,
  onClose,
  onSave,
}: {
  client: Client;
  onClose: () => void;
  onSave: (client: Client) => void;
}) {
  const [name, setName] = useState(client.name);
  const [category, setCategory] = useState(client.category);
  const [status, setStatus] = useState(client.status);
  const [nextAction, setNextAction] = useState(client.nextAction);
  const [amount, setAmount] = useState(client.amount);

  return (
    <div className="overlay">
      <section className="bottom-sheet form-sheet">
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <div>
            <span className="eyebrow">Клиент</span>
            <h2>Редактировать карточку</h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <div className="form-stack">
          <label>
            <span>Имя или компания</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <div>
            <span className="form-label">Тип клиента</span>
            <div className="form-segment">
              {(["Потенциальный", "Активный"] as const).map((value) => (
                <button
                  className={category === value ? "active" : ""}
                  key={value}
                  onClick={() => setCategory(value)}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <label>
            <span>Текущий статус</span>
            <input value={status} onChange={(event) => setStatus(event.target.value)} />
          </label>
          <label>
            <span>Следующее действие</span>
            <input
              value={nextAction}
              onChange={(event) => setNextAction(event.target.value)}
            />
          </label>
          <label>
            <span>Финансовый контекст</span>
            <input value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
        </div>
        <button
          className="primary-button"
          disabled={!name.trim() || !status.trim()}
          onClick={() =>
            onSave({
              ...client,
              name: name.trim(),
              category,
              status: status.trim(),
              nextAction: nextAction.trim() || "Определить следующее действие",
              amount: amount.trim() || "Не указано",
            })
          }
        >
          Сохранить изменения
        </button>
      </section>
    </div>
  );
}

function AttentionSheet({
  client,
  onClose,
  onSelect,
}: {
  client: Client;
  onClose: () => void;
  onSelect: (attention: Client["attention"]) => void;
}) {
  const options: Array<{
    value: Client["attention"];
    label: string;
    detail: string;
  }> = [
    { value: "calm", label: "Спокойно", detail: "Срочных действий нет" },
    { value: "active", label: "Активно", detail: "Есть текущее действие" },
    { value: "attention", label: "Требует внимания", detail: "Нужно принять решение" },
    { value: "overdue", label: "Просрочено", detail: "Есть нарушенный срок" },
  ];

  return (
    <div className="overlay" onClick={onClose}>
      <section className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <div>
            <span className="eyebrow">{client.name}</span>
            <h2>Уровень внимания</h2>
          </div>
          <button className="close-button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="attention-options">
          {options.map((option) => (
            <button
              key={option.value}
              className={client.attention === option.value ? "active" : ""}
              onClick={() => onSelect(option.value)}
            >
              <span className={`client-indicator ${option.value}`} />
              <span>
                <strong>{option.label}</strong>
                <small>{option.detail}</small>
              </span>
              {client.attention === option.value && <Check size={15} />}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function ClientMenuSheet({
  client,
  onClose,
  onEdit,
  onAttention,
  onCopy,
}: {
  client: Client;
  onClose: () => void;
  onEdit: () => void;
  onAttention: () => void;
  onCopy: () => void;
}) {
  const items = [
    {
      label: "Редактировать карточку",
      detail: "Имя, статус, следующее действие и финансы",
      icon: Pencil,
      action: onEdit,
    },
    {
      label: "Уровень внимания",
      detail: "Спокойно, активно, внимание или просрочено",
      icon: CircleAlert,
      action: onAttention,
    },
    {
      label: "Копировать сводку",
      detail: "Скопировать краткий контекст клиента",
      icon: Contact,
      action: onCopy,
    },
  ];

  return (
    <div className="overlay" onClick={onClose}>
      <section className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <div><span className="eyebrow">Клиент</span><h2>{client.name}</h2></div>
          <button className="close-button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="action-grid">
          {items.map(({ label, detail, icon: Icon, action }) => (
            <button className="action-choice client-menu-choice" key={label} onClick={action}>
              <span><Icon size={17} /></span>
              <span className="choice-copy">
                <strong>{label}</strong>
                <small>{detail}</small>
              </span>
              <ChevronRight size={16} className="choice-chevron" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function VoiceOverlay({
  state,
  seconds,
  error,
  scope,
  intent,
  proposals,
  transcript,
  proposalCards,
  clients,
  onProposal,
  onAssignClient,
  onCancel,
  onStop,
  onRetry,
  onApply,
}: {
  state: "recording" | "processing" | "review" | "error";
  seconds: number;
  error: string;
  scope: string;
  intent: ActionType | null;
  proposals: Record<string, ProposalState>;
  transcript: string;
  proposalCards: AIProposal[];
  clients: Client[];
  onProposal: (id: string, state: ProposalState) => void;
  onAssignClient: (proposalId: string, clientId: string) => void;
  onCancel: () => void;
  onStop: () => void;
  onRetry: () => void;
  onApply: (editedTitles: Record<string, string>) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedTitles, setEditedTitles] = useState<Record<string, string>>({});

  if (state === "review") {
    const kindLabels: Record<AIProposal["kind"], string> = {
      event: "Событие",
      task: "Задача",
      meeting: "Встреча",
      contact: "Контакт",
      note: "Заметка",
      client_update: "Карточка клиента",
      client_create: "Новый клиент",
    };
    const createdClientsByRef = new Map(
      proposalCards
        .filter(
          (proposal) =>
            proposal.kind === "client_create" && proposal.clientRef,
        )
        .map((proposal) => [proposal.clientRef as string, proposal]),
    );
    const cards = proposalCards.map((proposal) => ({
      ...proposal,
      type: kindLabels[proposal.kind],
      detail: proposal.requiresClarification
        ? "Нужно уточнить клиента или недостающие данные"
        : proposal.dueAt
          ? new Intl.DateTimeFormat("ru-RU", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(proposal.dueAt))
          : proposal.details || `Контекст · ${scope}`,
    }));
    const hasBrokenDependencies = cards.some((card) => {
      if (
        (proposals[card.id] ?? "pending") !== "accepted" ||
        card.kind === "client_create" ||
        !card.clientRef
      ) {
        return false;
      }
      const parent = createdClientsByRef.get(card.clientRef);
      return !parent || proposals[parent.id] !== "accepted";
    });
    return (
      <div className="overlay voice-overlay">
        <section className="review-sheet">
          <div className="review-head">
            <div>
              <span className="eyebrow">
                {intent ? actionLabels[intent] : "Общий AI-разбор"} · {scope}
              </span>
              <h2>{intent ? "Проверьте запись" : "Проверьте предложения"}</h2>
            </div>
            <button className="close-button" onClick={onRetry}>
              <X size={18} />
            </button>
          </div>
          <div className="transcript-preview">
            <span>Транскрипция</span>
            <p>«{transcript}»</p>
          </div>
          <div className="proposal-list">
            {cards.map((card) => {
              const status = proposals[card.id] ?? "pending";
              const linkedClient = card.clientRef
                ? createdClientsByRef.get(card.clientRef)
                : undefined;
              const confirmationBlocked =
                card.kind === "client_create"
                  ? !card.clientRef || !card.clientDraft?.name.trim()
                  : (!card.clientId && !card.clientRef) ||
                    (card.kind === "client_update" && !card.clientPatch);
              return (
                <article
                  className={`proposal-card proposal-${status}`}
                  key={card.id}
                >
                  <div>
                    <span className="proposal-type">{card.type}</span>
                    {editingId === card.id ? (
                      <input
                        className="proposal-edit-input"
                        autoFocus
                        value={editedTitles[card.id] ?? card.title}
                        onChange={(event) =>
                          setEditedTitles((current) => ({
                            ...current,
                            [card.id]: event.target.value,
                          }))
                        }
                        onBlur={() => setEditingId(null)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") setEditingId(null);
                        }}
                      />
                    ) : (
                      <h3>{editedTitles[card.id] ?? card.title}</h3>
                    )}
                    <p>{card.detail}</p>
                    {card.kind !== "client_create" &&
                      card.clientRef &&
                      linkedClient && (
                        <small className="proposal-link">
                          Будет привязано к новому клиенту:{" "}
                          <strong>
                            {editedTitles[linkedClient.id] ??
                              linkedClient.clientDraft?.name ??
                              linkedClient.title}
                          </strong>
                        </small>
                      )}
                    {card.kind !== "client_create" &&
                      !card.clientId &&
                      !card.clientRef && (
                      <label className="proposal-client-field">
                        <span>Выберите клиента</span>
                        <select
                          value=""
                          onChange={(event) =>
                            onAssignClient(card.id, event.target.value)
                          }
                        >
                          <option value="" disabled>
                            Клиент не определён
                          </option>
                          {clients.map((client) => (
                            <option value={client.id} key={client.id}>
                              {client.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      )}
                    {card.requiresClarification && !confirmationBlocked && (
                      <small className="proposal-advisory">
                        AI рекомендует проверить детали. Можно подтвердить как
                        есть или отредактировать название.
                      </small>
                    )}
                  </div>
                  <div className="proposal-actions">
                    {status === "rejected" ? (
                      <button
                        className="restore"
                        onClick={() => onProposal(card.id, "pending")}
                        aria-label="Вернуть предложение"
                      >
                        <Undo2 size={15} />
                      </button>
                    ) : (
                      <button
                        className="reject"
                        onClick={() => onProposal(card.id, "rejected")}
                        aria-label="Отклонить"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <button
                      className="edit"
                      aria-label="Изменить предложение"
                      onClick={() => setEditingId(card.id)}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      className="accept"
                      disabled={confirmationBlocked}
                      onClick={() => onProposal(card.id, "accepted")}
                      aria-label="Подтвердить"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
          <button
            className="primary-button"
            disabled={
              Object.keys(proposals).length === 0 ||
              Object.values(proposals).some((value) => value === "pending") ||
              hasBrokenDependencies
            }
            onClick={() => onApply(editedTitles)}
          >
            Применить решения
          </button>
          {hasBrokenDependencies && (
            <p className="proposal-dependency-error">
              Чтобы сохранить связанное действие, подтвердите создание его
              клиента или отклоните это действие.
            </p>
          )}
        </section>
      </div>
    );
  }

  return (
    <div
      className={`voice-modal ${state === "recording" ? "voice-modal-tappable" : ""}`}
      onClick={state === "recording" ? onStop : undefined}
      role={state === "recording" ? "button" : undefined}
      tabIndex={state === "recording" ? 0 : undefined}
      onKeyDown={(event) => {
        if (
          state === "recording" &&
          (event.key === "Enter" || event.key === " ")
        ) {
          onStop();
        }
      }}
    >
      <span className="eyebrow">
        {intent ? actionLabels[intent] : "Общий голосовой ввод"} · {scope}
      </span>
      {state === "recording" && (
        <>
          <div className="voice-orb">
            <span />
          </div>
          <h2>Идёт запись</h2>
          <strong className="voice-time">
            00:{String(seconds).padStart(2, "0")}
          </strong>
          <p>
            {intent
              ? `Расскажите, что нужно зафиксировать как ${actionLabels[intent].toLowerCase()}.`
              : "Говорите свободно. AI самостоятельно определит типы действий."}
          </p>
          {intent ? (
            <div className="recording-actions">
              <button
                className="voice-stop-button"
                onClick={(event) => {
                  event.stopPropagation();
                  onStop();
                }}
              >
                <CircleStop size={16} fill="currentColor" />
                Завершить
              </button>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onCancel();
                }}
              >
                Отменить
              </button>
            </div>
          ) : (
            <span className="release-hint">
              Нажмите в любом месте экрана для завершения
            </span>
          )}
        </>
      )}
      {state === "processing" && (
        <>
          <div className="processing-mark">✦</div>
          <h2>{intent ? "Подготавливаю запись" : "Разбираю голосовое"}</h2>
          <p>
            {intent
              ? `Транскрипция и проверка типа «${actionLabels[intent]}».`
              : "Транскрипция и разделение на отдельные предложения."}
          </p>
          <div className="processing-line">
            <span />
          </div>
        </>
      )}
      {state === "error" && (
        <>
          <div className="processing-mark error-mark">!</div>
          <h2>Не удалось начать запись</h2>
          <p>{error}</p>
          <button onClick={onRetry}>Закрыть</button>
        </>
      )}
    </div>
  );
}
