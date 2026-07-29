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
  Mic,
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
};

type AIProposal = {
  id: string;
  kind:
    | "event"
    | "task"
    | "meeting"
    | "contact"
    | "note"
    | "client_update";
  title: string;
  details: string | null;
  clientId: string | null;
  dueAt: string | null;
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

const seedClients: Client[] = [
  {
    id: "shaped-house",
    name: "Shaped House",
    category: "Активный",
    attention: "overdue",
    status: "Требует внимания",
    nextAction: "Отправить обновлённый отчёт",
    lastContact: "4 дня назад",
    lastContactDays: 4,
    amount: "€4 800",
  },
  {
    id: "domstar",
    name: "DomStar",
    category: "Активный",
    attention: "attention",
    status: "Ожидается ответ",
    nextAction: "Согласовать структуру лендинга",
    lastContact: "2 дня назад",
    lastContactDays: 2,
    amount: "$2 200",
  },
  {
    id: "irina",
    name: "Ирина",
    category: "Активный",
    attention: "active",
    status: "В работе",
    nextAction: "Zoom завтра в 19:00",
    lastContact: "сегодня",
    lastContactDays: 0,
    amount: "€1 600",
  },
  {
    id: "cretalina",
    name: "CRETALINA",
    category: "Потенциальный",
    attention: "calm",
    status: "Первичный контакт",
    nextAction: "Подготовить предложение",
    lastContact: "вчера",
    lastContactDays: 1,
    amount: "€1 000–1 500",
  },
  {
    id: "more",
    name: "Море",
    category: "Активный",
    attention: "active",
    status: "Поддержка",
    nextAction: "Проверить рекламные группы",
    lastContact: "3 дня назад",
    lastContactDays: 3,
    amount: "₴32 000",
  },
];

const initialTimeline: TimelineItem[] = [
  {
    id: "event-1",
    kind: "Задача",
    title: "Отправить обновлённый отчёт",
    detail: "Просрочено на 2 дня",
    date: "26 июля · 12:00",
    tone: "red",
  },
  {
    id: "event-2",
    kind: "Контакт",
    title: "Созвон по вопросам хостинга",
    detail: "Обсудили перенос сайта и обновление DNS",
    date: "24 июля · 16:30",
    tone: "blue",
  },
  {
    id: "event-3",
    kind: "Событие",
    title: "Клиент одобрил новое направление",
    detail: "Можно готовить оценку дополнительной страницы",
    date: "22 июля · 10:15",
    tone: "green",
  },
  {
    id: "event-4",
    kind: "Заметка",
    title: "Важно сохранить компактную структуру",
    detail: "Не перегружать главную страницу анимациями",
    date: "20 июля · 18:40",
    tone: "gray",
  },
];

const initialTimelines: Record<string, TimelineItem[]> = {
  "shaped-house": initialTimeline,
  domstar: [
    {
      id: "domstar-1",
      kind: "Задача",
      title: "Согласовать структуру лендинга",
      detail: "Ожидается ответ клиента",
      date: "27 июля · 15:20",
      tone: "red",
    },
    {
      id: "domstar-2",
      kind: "Контакт",
      title: "Отправлена новая структура",
      detail: "Зафиксированы два варианта первого экрана",
      date: "26 июля · 11:10",
      tone: "blue",
    },
  ],
  irina: [
    {
      id: "irina-1",
      kind: "Встреча",
      title: "Zoom по следующей итерации",
      detail: "Обсудить структуру и приоритеты",
      date: "Завтра · 19:00",
      tone: "green",
    },
    {
      id: "irina-2",
      kind: "Контакт",
      title: "Подтвердили время встречи",
      detail: "Клиент на связи, дополнительных вопросов нет",
      date: "Сегодня · 10:40",
      tone: "blue",
    },
  ],
  cretalina: [
    {
      id: "cretalina-1",
      kind: "Задача",
      title: "Подготовить предложение",
      detail: "Первичная оценка проекта",
      date: "30 июля",
      tone: "gray",
    },
  ],
  more: [
    {
      id: "more-1",
      kind: "Задача",
      title: "Проверить рекламные группы",
      detail: "Еженедельный аудит",
      date: "29 июля · 14:00",
      tone: "green",
    },
  ],
};

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
  const [clientRecords, setClientRecords] = useState<Client[]>(seedClients);
  const [selectedClient, setSelectedClient] = useState<Client>(seedClients[0]);
  const [timelines, setTimelines] =
    useState<Record<string, TimelineItem[]>>(initialTimelines);
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
          ? selectedClient.name
          : screen === "finances"
            ? "Финансы"
            : "Направления";

  const acceptedProposals = useMemo(
    () =>
      Object.values(proposalStates).filter((state) => state === "accepted")
        .length,
    [proposalStates],
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
        if (snapshot.clients[0]) setSelectedClient(snapshot.clients[0]);
      })
      .catch(() => {
        if (mounted) {
          setToast("Работаем на локальных демо-данных");
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
    const currentId = selectedId ?? selectedClient.id;
    const current = snapshot.clients.find((client) => client.id === currentId);
    if (current) setSelectedClient(current);
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
      if (screen === "client") formData.append("clientId", selectedClient.id);
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
      stopRecording();
      return;
    }
    setActionOpen(true);
  };

  const handleActionPointerCancel = () => {
    pointerHeld.current = false;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = null;
    if (longPressTriggered.current) stopRecording();
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
            overdueCount={
              clientRecords.filter((client) => client.attention === "overdue")
                .length
            }
            attentionCount={
              clientRecords.filter(
                (client) => client.attention === "attention",
              ).length
            }
            onClients={() => setScreen("clients")}
            onFinances={() => setScreen("finances")}
            onDirections={() => setScreen("directions")}
          />
        )}

        {screen === "clients" && (
          <ClientsScreen
            view={clientsView}
            clients={clientRecords}
            onViewChange={setClientsView}
            onOpenClient={openClient}
          />
        )}

        {screen === "client" && (
          <ClientScreen
            client={selectedClient}
            view={clientView}
            onViewChange={setClientView}
            timeline={timelines[selectedClient.id] ?? []}
            taskCompleted={
              completedTasks.includes(selectedClient.id) ||
              (timelines[selectedClient.id] ?? []).some(
                (item) => item.kind === "Задача" && item.tone === "green",
              )
            }
            taskPostponed={postponedTasks.includes(selectedClient.id)}
            onCompleteTask={async () => {
              const task = (timelines[selectedClient.id] ?? []).find(
                (item) => item.kind === "Задача",
              );
              if (!task) return showToast("У клиента нет открытой задачи");
              if (await updateEvent(task.id, { completed: true })) {
                setCompletedTasks((items) => [...items, selectedClient.id]);
                showToast("Задача выполнена и сохранена");
              }
            }}
            onPostponeTask={async () => {
              const task = (timelines[selectedClient.id] ?? []).find(
                (item) => item.kind === "Задача",
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
            onAction={showToast}
          />
        )}

        {screen === "directions" && (
          <DirectionsScreen
            view={directionsView}
            onViewChange={setDirectionsView}
            onAction={showToast}
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
          <span className="hold-label">
            <Mic size={10} /> удержать
          </span>
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
          onProposal={setProposal}
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
            showToast(`${label}: демо-раздел открыт`);
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

      {clientMenuOpen && (
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

      {clientEditOpen && (
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

      {attentionOpen && (
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
  onClients,
  onFinances,
  onDirections,
}: {
  clientCount: number;
  overdueCount: number;
  attentionCount: number;
  onClients: () => void;
  onFinances: () => void;
  onDirections: () => void;
}) {
  return (
    <div className="screen home-screen">
      <div className="screen-intro">
        <span className="eyebrow">Вторник, 28 июля</span>
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
          <span className="agenda-count">3</span>
        </div>
        <button className="agenda-row" onClick={onClients}>
          <span className="agenda-icon agenda-danger">
            <CircleAlert size={16} />
          </span>
          <span className="agenda-copy">
            <strong>Отправить обновлённый отчёт</strong>
            <small>Shaped House · просрочено на 2 дня</small>
          </span>
          <ChevronRight size={15} />
        </button>
        <button className="agenda-row" onClick={onClients}>
          <span className="agenda-icon agenda-blue">
            <CalendarClock size={16} />
          </span>
          <span className="agenda-copy">
            <strong>Zoom с Ириной</strong>
            <small>Сегодня · 19:00</small>
          </span>
          <ChevronRight size={15} />
        </button>
        <button className="agenda-row" onClick={onClients}>
          <span className="agenda-icon agenda-purple">
            <Sparkles size={16} />
          </span>
          <span className="agenda-copy">
            <strong>Проверить новое предложение AI</strong>
            <small>DomStar · контекст клиента</small>
          </span>
          <ChevronRight size={15} />
        </button>
      </section>
    </div>
  );
}

function FinanceScreen({
  view,
  onViewChange,
  onAction,
}: {
  view: FinanceView;
  onViewChange: (view: FinanceView) => void;
  onAction: (message: string) => void;
}) {
  const transactions = [
    { id: 1, title: "Shaped House", meta: "Оплата · июль", value: "+ €4 800" },
    { id: 2, title: "Figma", meta: "Подписка", value: "− €15" },
    { id: 3, title: "DomStar", meta: "Ожидается · 2 августа", value: "+ $2 200" },
    { id: 4, title: "Railway", meta: "Инфраструктура", value: "− $20" },
  ];

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
              <span>Прогноз на август</span>
              <TrendingUp size={18} />
            </div>
            <strong>€8 420</strong>
            <small>+12% к текущему месяцу</small>
            <div className="balance-progress"><span /></div>
          </section>
          <div className="finance-metrics">
            <article>
              <span>Получено</span>
              <strong>€6 400</strong>
              <small>3 платежа</small>
            </article>
            <article>
              <span>Ожидается</span>
              <strong>€3 200</strong>
              <small>до 5 августа</small>
            </article>
          </div>
          <section className="finance-context-card">
            <div className="panel-title">
              <div>
                <span className="eyebrow">Контекст</span>
                <h2>Требует решения</h2>
              </div>
              <span className="count-pill">2</span>
            </div>
            <button
              className="finance-decision-row"
              onClick={() => onAction("Бюджет DomStar открыт")}
            >
              <span>Согласовать новый бюджет DomStar</span>
              <ChevronRight size={15} />
            </button>
            <button
              className="finance-decision-row"
              onClick={() => onAction("Оплата CRETALINA открыта")}
            >
              <span>Проверить оплату CRETALINA</span>
              <ChevronRight size={15} />
            </button>
          </section>
        </>
      ) : (
        <div className="transaction-list">
          <div className="list-summary">
            <span>Последние операции</span>
            <strong>{transactions.length}</strong>
          </div>
          {transactions.map((transaction) => (
            <button
              className="transaction-row"
              key={transaction.id}
              onClick={() => onAction(`${transaction.title}: операция открыта`)}
            >
              <span className="transaction-icon">
                <WalletCards size={16} />
              </span>
              <span>
                <strong>{transaction.title}</strong>
                <small>{transaction.meta}</small>
              </span>
              <b>{transaction.value}</b>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DirectionsScreen({
  view,
  onViewChange,
  onAction,
}: {
  view: DirectionsView;
  onViewChange: (view: DirectionsView) => void;
  onAction: (message: string) => void;
}) {
  const directions = [
    {
      id: "pbos",
      name: "ORGAZME",
      stage: "MVP · активное",
      progress: 42,
      next: "Завершить интерактивный прототип",
      tone: "blue",
    },
    {
      id: "agency",
      name: "Client Studio",
      stage: "Рабочее направление",
      progress: 68,
      next: "Обновить пакет услуг",
      tone: "purple",
    },
    {
      id: "research",
      name: "AI Research",
      stage: "Исследование",
      progress: 23,
      next: "Проверить голосовые сценарии",
      tone: "green",
    },
  ];

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
              <strong>3</strong>
              <small>направления</small>
            </article>
            <article className="metric-card">
              <span>В фокусе</span>
              <strong>1</strong>
              <small>ORGAZME</small>
            </article>
            <article className="metric-card">
              <span>Идей</span>
              <strong>7</strong>
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
                <h2>ORGAZME</h2>
                <p>Интерактивный MVP</p>
              </div>
            </div>
            <div className="focus-progress"><span /></div>
            <strong>Следующее: завершить все интерфейсные сценарии</strong>
          </section>
        </>
      ) : (
        <div className="direction-project-list">
          {directions.map((direction) => (
            <button
              className="project-row"
              key={direction.id}
              onClick={() => onAction(`${direction.name}: направление открыто`)}
            >
              <div className={`project-tone ${direction.tone}`} />
              <div>
                <strong>{direction.name}</strong>
                <small>{direction.stage}</small>
                <p>{direction.next}</p>
                <span className="project-progress">
                  <i style={{ width: `${direction.progress}%` }} />
                </span>
              </div>
              <ChevronRight size={15} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ClientsScreen({
  view,
  clients,
  onViewChange,
  onOpenClient,
}: {
  view: ClientsView;
  clients: Client[];
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
  onOpenClient,
  onShowActive,
  onShowAttention,
  onShowToday,
}: {
  clients: Client[];
  onOpenClient: (client: Client) => void;
  onShowActive: () => void;
  onShowAttention: () => void;
  onShowToday: () => void;
}) {
  const shapedHouse = clients.find((client) => client.name === "Shaped House");
  const irina = clients.find((client) => client.name === "Ирина");
  const overdueCount = clients.filter(
    (client) => client.attention === "overdue",
  ).length;
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
          <strong className="danger-text">{overdueCount}</strong>
          <small>клиентов</small>
        </button>
        <button className="metric-card" onClick={onShowToday}>
          <span>Сегодня</span>
          <strong>{Math.min(3, clients.length)}</strong>
          <small>в фокусе</small>
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
        {clients
          .filter(
            (client) =>
              client.attention === "overdue" ||
              client.attention === "attention",
          )
          .slice(0, 2)
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
          ))}
      </section>

      <section className="today-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">28 июля</span>
            <h2>Сегодня</h2>
          </div>
        </div>
        <button
          className="today-line"
          onClick={() => shapedHouse && onOpenClient(shapedHouse)}
        >
          <time>12:00</time>
          <span className="timeline-pin blue" />
          <div>
            <strong>Отправить отчёт</strong>
            <small>Shaped House · просрочено</small>
          </div>
          <ChevronRight size={14} />
        </button>
        <button
          className="today-line"
          onClick={() => irina && onOpenClient(irina)}
        >
          <time>19:00</time>
          <span className="timeline-pin green" />
          <div>
            <strong>Zoom с Ириной</strong>
            <small>Обсудить следующую итерацию</small>
          </div>
          <ChevronRight size={14} />
        </button>
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
          <Search size={22} />
          <strong>Ничего не найдено</strong>
          <span>Измените запрос или отключите фильтр.</span>
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
  taskCompleted,
  taskPostponed,
  onCompleteTask,
  onPostponeTask,
  onOpenEvents,
}: {
  client: Client;
  taskCompleted: boolean;
  taskPostponed: boolean;
  onCompleteTask: () => void;
  onPostponeTask: () => void;
  onOpenEvents: () => void;
}) {
  const attentionCopy: Record<
    Client["attention"],
    { label: string; level: string; due: string }
  > = {
    overdue: {
      label: "Просрочено 2 дня",
      level: "Высокий",
      due: "Срок: 26 июля · 12:00",
    },
    attention: {
      label: "Требует внимания",
      level: "Повышенный",
      due: "Ожидается решение",
    },
    active: {
      label: "Активно",
      level: "Рабочий",
      due: client.id === "irina" ? "Завтра · 19:00" : "В работе",
    },
    calm: {
      label: "Без срочности",
      level: "Спокойный",
      due: "Срок не назначен",
    },
  };
  const attentionState = attentionCopy[client.attention];
  const taskClass = taskCompleted
    ? "task-completed"
    : taskPostponed
      ? "task-postponed"
      : `task-${client.attention}`;
  const contactDetail =
    client.id === "irina"
      ? "Подтверждение встречи"
      : client.id === "shaped-house"
        ? "Созвон по хостингу"
        : "Последнее взаимодействие";
  const nextMeeting =
    client.id === "irina"
      ? { date: "Завтра", time: "19:00 · Zoom" }
      : { date: "30 июля", time: "12:00 · Zoom" };

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
            {taskCompleted
              ? "Выполнено"
              : taskPostponed
                ? "Перенесено"
                : attentionState.label}
          </span>
        </div>
        <h2>{client.nextAction}</h2>
        <p>
          {taskCompleted
            ? "Завершено только что"
            : taskPostponed
              ? "Новый срок: 30 июля · 12:00"
              : attentionState.due}
        </p>
        {!taskCompleted && (
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
          <small>{contactDetail}</small>
        </article>
        <article className="info-card">
          <span>Ближайшая встреча</span>
          <strong>{nextMeeting.date}</strong>
          <small>{nextMeeting.time}</small>
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
  onClose,
  onOpenClient,
}: {
  clients: Client[];
  onClose: () => void;
  onOpenClient: (client: Client) => void;
}) {
  const actions = [
    {
      clientKey: "Shaped House",
      time: "12:00",
      title: "Отправить обновлённый отчёт",
      detail: "Просрочено · требует решения",
      tone: "agenda-danger",
      icon: CircleAlert,
    },
    {
      clientKey: "Ирина",
      time: "19:00",
      title: "Zoom с Ириной",
      detail: "Обсудить следующую итерацию",
      tone: "agenda-blue",
      icon: CalendarClock,
    },
    {
      clientKey: "DomStar",
      time: "До конца дня",
      title: "Проверить ответ DomStar",
      detail: "Согласование структуры лендинга",
      tone: "agenda-purple",
      icon: Contact,
    },
  ];

  return (
    <div className="overlay" onClick={onClose}>
      <section className="bottom-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-heading">
          <div>
            <span className="eyebrow">28 июля</span>
            <h2>Действия сегодня</h2>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Закрыть">
            <X size={18} />
          </button>
        </div>
        <div className="notification-list">
          {actions.map(({ clientKey, time, title, detail, tone, icon: Icon }) => {
            const client = clients.find(
              (item) => item.id === clientKey || item.name === clientKey,
            );
            return (
              <button
                key={clientKey}
                onClick={() => client && onOpenClient(client)}
              >
                <span className={`agenda-icon ${tone}`}><Icon size={16} /></span>
                <span>
                  <strong>{title}</strong>
                  <small>{time} · {detail}</small>
                </span>
                <ChevronRight size={15} />
              </button>
            );
          })}
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
  onClose,
  onOpenClient,
}: {
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
          <button onClick={() => onOpenClient("Shaped House")}>
            <span className="agenda-icon agenda-danger"><CircleAlert size={16} /></span>
            <span><strong>Задача просрочена</strong><small>Shaped House · 2 дня</small></span>
            <ChevronRight size={15} />
          </button>
          <button onClick={() => onOpenClient("Ирина")}>
            <span className="agenda-icon agenda-blue"><CalendarClock size={16} /></span>
            <span><strong>Встреча сегодня</strong><small>Ирина · 19:00</small></span>
            <ChevronRight size={15} />
          </button>
          <button onClick={() => onOpenClient("DomStar")}>
            <span className="agenda-icon agenda-purple"><Sparkles size={16} /></span>
            <span><strong>AI ждёт подтверждения</strong><small>DomStar · новое предложение</small></span>
            <ChevronRight size={15} />
          </button>
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
  onProposal,
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
  onProposal: (id: string, state: ProposalState) => void;
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
    };
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
                    {card.requiresClarification && (
                      <small>Это предложение нельзя применить без уточнения.</small>
                    )}
                  </div>
                  <div className="proposal-actions">
                    <button
                      className="reject"
                      onClick={() => onProposal(card.id, "rejected")}
                      aria-label="Отклонить"
                    >
                      <X size={14} />
                    </button>
                    <button
                      className="edit"
                      aria-label="Изменить предложение"
                      onClick={() => setEditingId(card.id)}
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      className="accept"
                      disabled={card.requiresClarification}
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
              Object.values(proposals).some((value) => value === "pending")
            }
            onClick={() => onApply(editedTitles)}
          >
            Применить решения
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="voice-modal">
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
              <button className="voice-stop-button" onClick={onStop}>
                <CircleStop size={16} fill="currentColor" />
                Завершить
              </button>
              <button onClick={onCancel}>Отменить</button>
            </div>
          ) : (
            <span className="release-hint">Отпустите кнопку для завершения</span>
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
