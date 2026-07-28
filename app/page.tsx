"use client";

import {
  ArrowLeft,
  Bell,
  CalendarDays,
  Check,
  CheckSquare2,
  ChevronRight,
  CircleStop,
  Clock3,
  Contact,
  House,
  LayoutDashboard,
  Layers3,
  List,
  Mic,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  StickyNote,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";

type Screen = "home" | "clients" | "client";
type ClientsView = "dashboard" | "list";
type ClientView = "dashboard" | "events";
type ActionType = "event" | "task" | "meeting" | "contact" | "note";
type ProposalState = "pending" | "accepted" | "rejected";

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

const clients: Client[] = [
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
  const [selectedClient, setSelectedClient] = useState<Client>(clients[0]);
  const [timeline, setTimeline] = useState(initialTimeline);
  const [actionOpen, setActionOpen] = useState(false);
  const [draftType, setDraftType] = useState<ActionType | null>(null);
  const [draftText, setDraftText] = useState("");
  const [voiceState, setVoiceState] = useState<
    "idle" | "recording" | "processing" | "review" | "error"
  >("idle");
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceError, setVoiceError] = useState("");
  const [proposalStates, setProposalStates] = useState<
    Record<string, ProposalState>
  >({});

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
        : selectedClient.name;

  const acceptedProposals = useMemo(
    () =>
      Object.values(proposalStates).filter((state) => state === "accepted")
        .length,
    [proposalStates],
  );

  const goBack = () => {
    if (screen === "client") {
      setScreen("clients");
      setClientView("dashboard");
      return;
    }
    if (screen === "clients") {
      setScreen("home");
      setClientsView("dashboard");
    }
  };

  const openClient = (client: Client) => {
    setSelectedClient(client);
    setScreen("client");
    setClientView("dashboard");
  };

  const openTypedAction = (type: ActionType) => {
    setActionOpen(false);
    setDraftType(type);
    setDraftText("");
  };

  const saveTypedAction = () => {
    if (!draftType || !draftText.trim()) return;
    const newItem: TimelineItem = {
      id: `manual-${Date.now()}`,
      kind: actionLabels[draftType],
      title: draftText.trim(),
      detail:
        screen === "client"
          ? `Добавлено в контекст: ${selectedClient.name}`
          : `Контекст: ${scopeLabel}`,
      date: "только что",
      tone: draftType === "task" ? "red" : "blue",
    };
    if (screen === "client") setTimeline((items) => [newItem, ...items]);
    setDraftType(null);
    setDraftText("");
  };

  const startRecording = async () => {
    longPressTriggered.current = true;
    setActionOpen(false);
    setVoiceError("");
    setRecordingSeconds(0);
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        throw new Error("Запись голоса не поддерживается этим браузером.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!pointerHeld.current) {
        stream.getTracks().forEach((track) => track.stop());
        setVoiceState("idle");
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
        window.setTimeout(() => {
          setProposalStates({});
          setVoiceState("review");
        }, 1250);
      };
      recorder.stop();
      return;
    }
    mediaStream.current?.getTracks().forEach((track) => track.stop());
  };

  const handleActionPointerDown = () => {
    pointerHeld.current = true;
    longPressTriggered.current = false;
    holdTimer.current = setTimeout(startRecording, 420);
  };

  const handleActionPointerUp = () => {
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
  };

  const setProposal = (id: string, state: ProposalState) => {
    setProposalStates((current) => ({ ...current, [id]: state }));
  };

  const applyProposals = () => {
    if (acceptedProposals > 0 && screen === "client") {
      setTimeline((items) => [
        {
          id: `ai-${Date.now()}`,
          kind: "AI · подтверждено",
          title: `${acceptedProposals} изменения добавлены`,
          detail: "Карточка и рабочий контекст обновлены",
          date: "только что",
          tone: "green",
        },
        ...items,
      ]);
    }
    setVoiceState("idle");
    setProposalStates({});
  };

  return (
    <main className="app-shell">
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
          <button className="icon-button" aria-label="Уведомления">
            <span className="notification-dot" />
            <Bell size={18} strokeWidth={1.9} />
          </button>
          <button className="icon-button" aria-label="Меню">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>

      <section className="workspace">
        {screen === "home" && (
          <HomeScreen onClients={() => setScreen("clients")} />
        )}

        {screen === "clients" && (
          <ClientsScreen
            view={clientsView}
            onViewChange={setClientsView}
            onOpenClient={openClient}
          />
        )}

        {screen === "client" && (
          <ClientScreen
            client={selectedClient}
            view={clientView}
            onViewChange={setClientView}
            timeline={timeline}
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
        <button className="tab-item future-tab">
          <WalletCards size={20} strokeWidth={2} />
          <span>Финансы</span>
        </button>
        <button className="tab-item future-tab">
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
            <div className="action-grid">
              {(Object.keys(actionLabels) as ActionType[]).map((type) => (
                <ActionChoice
                  key={type}
                  type={type}
                  onClick={() => openTypedAction(type)}
                />
              ))}
              {screen !== "client" && (
                <button className="action-choice action-choice-wide">
                  <span><Plus size={17} /></span>
                  Новый клиент
                  <ChevronRight size={16} className="choice-chevron" />
                </button>
              )}
            </div>
          </section>
        </div>
      )}

      {draftType && (
        <div className="overlay">
          <section className="bottom-sheet draft-sheet">
            <div className="sheet-handle" />
            <div className="sheet-heading">
              <div>
                <span className="eyebrow">{scopeLabel}</span>
                <h2>Новая {actionLabels[draftType].toLowerCase()}</h2>
              </div>
              <button
                className="close-button"
                onClick={() => setDraftType(null)}
                aria-label="Закрыть"
              >
                <X size={18} />
              </button>
            </div>
            <label className="field-label" htmlFor="draft-input">
              Что нужно зафиксировать?
            </label>
            <textarea
              id="draft-input"
              autoFocus
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              placeholder={
                draftType === "task"
                  ? "Например: отправить отчёт завтра в 12:00"
                  : "Опишите коротко или используйте диктовку клавиатуры"
              }
            />
            <div className="draft-meta">
              <button className="meta-chip">Сегодня</button>
              <button className="meta-chip">Без приоритета</button>
            </div>
            <button
              className="primary-button"
              disabled={!draftText.trim()}
              onClick={saveTypedAction}
            >
              Сохранить
            </button>
          </section>
        </div>
      )}

      {voiceState !== "idle" && (
        <VoiceOverlay
          state={voiceState}
          seconds={recordingSeconds}
          error={voiceError}
          scope={scopeLabel}
          proposals={proposalStates}
          onProposal={setProposal}
          onCancel={cancelRecording}
          onRetry={() => setVoiceState("idle")}
          onApply={applyProposals}
        />
      )}
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

function HomeScreen({ onClients }: { onClients: () => void }) {
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
            <p>5 активных клиентов</p>
          </div>
          <div className="direction-summary">
            <span><i className="summary-dot danger-dot" />1 просрочено</span>
            <span><i className="summary-dot warn-dot" />1 ждёт внимания</span>
          </div>
        </button>

        <button className="direction-card">
          <div className="direction-topline">
            <span className="direction-icon finance-icon"><WalletCards size={19} /></span>
            <span className="soon-chip">Скоро</span>
          </div>
          <div>
            <h2>Финансы</h2>
            <p>Факт · план · возможности</p>
          </div>
        </button>

        <button className="direction-card">
          <div className="direction-topline">
            <span className="direction-icon projects-icon"><Layers3 size={19} /></span>
            <span className="soon-chip">Скоро</span>
          </div>
          <div>
            <h2>Направления</h2>
            <p>Проекты, развитие и идеи</p>
          </div>
        </button>
      </div>
    </div>
  );
}

function ClientsScreen({
  view,
  onViewChange,
  onOpenClient,
}: {
  view: ClientsView;
  onViewChange: (view: ClientsView) => void;
  onOpenClient: (client: Client) => void;
}) {
  return (
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
          onChange={onViewChange}
        />
      </div>

      {view === "dashboard" ? (
        <ClientsDashboard onOpenClient={onOpenClient} />
      ) : (
        <ClientsList onOpenClient={onOpenClient} />
      )}
    </div>
  );
}

function ClientsDashboard({
  onOpenClient,
}: {
  onOpenClient: (client: Client) => void;
}) {
  return (
    <>
      <div className="metric-grid">
        <article className="metric-card metric-primary">
          <span>Активные</span>
          <strong>4</strong>
          <small>из 5 клиентов</small>
        </article>
        <article className="metric-card">
          <span>Просрочено</span>
          <strong className="danger-text">1</strong>
          <small>задача</small>
        </article>
        <article className="metric-card">
          <span>Сегодня</span>
          <strong>3</strong>
          <small>действия</small>
        </article>
      </div>

      <section className="attention-panel">
        <div className="panel-title">
          <div>
            <span className="eyebrow">Приоритет</span>
            <h2>Требуют внимания</h2>
          </div>
          <span className="count-pill">2</span>
        </div>
        {clients.slice(0, 2).map((client) => (
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
        <div className="today-line">
          <time>12:00</time>
          <span className="timeline-pin blue" />
          <div>
            <strong>Отправить отчёт</strong>
            <small>Shaped House · просрочено</small>
          </div>
        </div>
        <div className="today-line">
          <time>19:00</time>
          <span className="timeline-pin green" />
          <div>
            <strong>Zoom с Ириной</strong>
            <small>Обсудить следующую итерацию</small>
          </div>
        </div>
      </section>
    </>
  );
}

function ClientsList({
  onOpenClient,
}: {
  onOpenClient: (client: Client) => void;
}) {
  return (
    <div className="client-list">
      <div className="list-summary">
        <span>Сначала требующие внимания</span>
        <strong>5 клиентов</strong>
      </div>
      {clients.map((client) => (
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
    </div>
  );
}

function ClientScreen({
  client,
  view,
  onViewChange,
  timeline,
}: {
  client: Client;
  view: ClientView;
  onViewChange: (view: ClientView) => void;
  timeline: TimelineItem[];
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
        <button className="more-button" aria-label="Действия клиента">
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
        <ClientDashboard client={client} />
      ) : (
        <ClientTimeline timeline={timeline} />
      )}
    </div>
  );
}

function ClientDashboard({ client }: { client: Client }) {
  return (
    <div className="client-dashboard">
      <section className="current-task-card">
        <div className="task-label">
          <span>Текущая задача</span>
          <span className="overdue-pill">Просрочено 2 дня</span>
        </div>
        <h2>{client.nextAction}</h2>
        <p>Срок: 26 июля · 12:00</p>
        <div className="task-actions">
          <button>Выполнено</button>
          <button>Перенести</button>
        </div>
      </section>

      <div className="info-grid">
        <article className="info-card">
          <span>Последний контакт</span>
          <strong>{client.lastContact}</strong>
          <small>Созвон по хостингу</small>
        </article>
        <article className="info-card">
          <span>Ближайшая встреча</span>
          <strong>30 июля</strong>
          <small>12:00 · Zoom</small>
        </article>
        <article className="info-card">
          <span>Финансовый контекст</span>
          <strong>{client.amount}</strong>
          <small>Рабочая оценка</small>
        </article>
        <article className="info-card">
          <span>Уровень внимания</span>
          <strong>Высокий</strong>
          <small>Можно изменить вручную</small>
        </article>
      </div>

      <section className="summary-card">
        <span className="eyebrow">Подтверждённый контекст</span>
        <h2>Коротко о состоянии</h2>
        <p>
          Клиент активен. Последний контакт был четыре дня назад. Есть
          просроченная задача и согласован следующий созвон.
        </p>
        <button>Открыть события →</button>
      </section>
    </div>
  );
}

function ClientTimeline({ timeline }: { timeline: TimelineItem[] }) {
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
          <button aria-label="Редактировать событие">···</button>
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

function VoiceOverlay({
  state,
  seconds,
  error,
  scope,
  proposals,
  onProposal,
  onCancel,
  onRetry,
  onApply,
}: {
  state: "recording" | "processing" | "review" | "error";
  seconds: number;
  error: string;
  scope: string;
  proposals: Record<string, ProposalState>;
  onProposal: (id: string, state: ProposalState) => void;
  onCancel: () => void;
  onRetry: () => void;
  onApply: () => void;
}) {
  if (state === "review") {
    const cards = [
      {
        id: "contact",
        type: "Контакт",
        title: "Созвон по вопросам хостинга",
        detail: "Вчера · Shaped House",
      },
      {
        id: "task",
        type: "Задача",
        title: "Отправить обновлённые данные",
        detail: "Завтра · 12:00",
      },
      {
        id: "meeting",
        type: "Встреча",
        title: "Провести Zoom на следующей неделе",
        detail: "Нужно уточнить точную дату",
      },
    ];
    return (
      <div className="overlay voice-overlay">
        <section className="review-sheet">
          <div className="review-head">
            <div>
              <span className="eyebrow">AI-разбор · {scope}</span>
              <h2>Проверьте предложения</h2>
            </div>
            <button className="close-button" onClick={onRetry}>
              <X size={18} />
            </button>
          </div>
          <div className="transcript-preview">
            <span>Транскрипция</span>
            <p>
              «Вчера созванивались по хостингу. Завтра в двенадцать нужно
              отправить данные и на следующей неделе провести Zoom».
            </p>
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
                    <h3>{card.title}</h3>
                    <p>{card.detail}</p>
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
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      className="accept"
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
            onClick={onApply}
          >
            Применить решения
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="voice-modal">
      <span className="eyebrow">{scope}</span>
      {state === "recording" && (
        <>
          <div className="voice-orb">
            <span />
          </div>
          <h2>Идёт запись</h2>
          <strong className="voice-time">
            00:{String(seconds).padStart(2, "0")}
          </strong>
          <p>Отпустите кнопку, чтобы завершить.</p>
          <button onClick={onCancel}>Отменить</button>
        </>
      )}
      {state === "processing" && (
        <>
          <div className="processing-mark">✦</div>
          <h2>Разбираю событие</h2>
          <p>Транскрипция и подготовка отдельных предложений.</p>
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
