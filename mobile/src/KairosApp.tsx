import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
  type DimensionValue,
} from 'react-native';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { Ionicons } from '@expo/vector-icons';
import { calendarItems as localCalendarItems, initialTasks } from './sampleData';
import { fetchGoogleCalendarItems, fetchGoogleTasks } from './googleSync';
import { loadCalendarItems, loadCaptureDrafts, loadEnergy, loadRecentCaptures, loadTasks, loadTheme, saveCalendarItems, saveCaptureDrafts, saveEnergy, saveRecentCaptures, saveTasks, saveTheme } from './storage';
import { darkColors, lightColors, radii, shadow, type Palette, type ThemeName } from './theme';

const ThemeContext = createContext<{ colors: Palette; theme: ThemeName; toggleTheme: () => void }>({
  colors: lightColors,
  theme: 'light',
  toggleTheme: () => {},
});

const useTheme = () => useContext(ThemeContext);
const useStyles = () => {
  const { colors } = useTheme();
  return useMemo(() => makeStyles(colors), [colors]);
};
import { useGoogleAuth } from './useGoogleAuth';
import type { CalendarItem, CaptureDraft, EnergyLevel, ScreenKey, Task } from './types';

const initialCaptureDrafts: CaptureDraft[] = [];

const dayKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const isDayKey = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s);

const resolveDayKey = (relative: string | undefined): string => {
  const now = new Date();
  if (!relative) {
    now.setDate(now.getDate() + 1);
    return dayKey(now);
  }
  if (isDayKey(relative)) return relative;
  const lower = relative.toLowerCase();
  if (lower === 'today') return dayKey(now);
  if (lower === 'tomorrow') {
    now.setDate(now.getDate() + 1);
    return dayKey(now);
  }
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const idx = weekdays.indexOf(lower);
  if (idx >= 0) {
    const diff = (idx - now.getDay() + 7) % 7 || 7;
    now.setDate(now.getDate() + diff);
    return dayKey(now);
  }
  now.setDate(now.getDate() + 1);
  return dayKey(now);
};

const tabs: { key: ScreenKey; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'capture', label: 'capture', icon: 'mic-outline' },
  { key: 'today', label: 'today', icon: 'ellipse-outline' },
  { key: 'calendar', label: 'calendar', icon: 'calendar-clear-outline' },
  { key: 'focus', label: 'focus', icon: 'leaf-outline' },
];

export default function KairosApp() {
  const [screen, setScreen] = useState<ScreenKey>('today');
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [calendarItems, setCalendarItems] = useState<CalendarItem[]>(localCalendarItems);
  const [captureDrafts, setCaptureDrafts] = useState<CaptureDraft[]>(initialCaptureDrafts);
  const [energy, setEnergy] = useState<EnergyLevel | null>(null);
  const [captureUri, setCaptureUri] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState('');
  const [undo, setUndo] = useState<{ label: string; apply: () => void } | null>(null);
  const [editing, setEditing] = useState<{ kind: 'task' | 'event'; id: string } | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(initialTasks[1]?.id ?? null);
  const [focusRunning, setFocusRunning] = useState(false);
  const [theme, setTheme] = useState<ThemeName>('light');
  const [recentCaptures, setRecentCaptures] = useState<string[]>([]);
  const google = useGoogleAuth();

  const palette = theme === 'dark' ? darkColors : lightColors;
  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  const themeValue = useMemo(() => ({ colors: palette, theme, toggleTheme }), [palette, theme]);
  const styles = useMemo(() => makeStyles(palette), [palette]);

  const activeTasks = useMemo(() => tasks.filter((task) => !task.completed), [tasks]);
  const todayTasks = activeTasks.filter((task) => task.bucket === 'today');
  const laterTasks = activeTasks.filter((task) => task.bucket === 'later');
  const focusedTask = activeTasks.find((task) => task.id === focusTaskId) ?? activeTasks[0] ?? null;

  useEffect(() => {
    Promise.all([
      loadTasks(initialTasks),
      loadEnergy(),
      loadCaptureDrafts(initialCaptureDrafts),
      loadCalendarItems(localCalendarItems),
      loadTheme(),
      loadRecentCaptures(),
    ]).then(([storedTasks, storedEnergy, storedDrafts, storedCalendarItems, storedTheme, storedRecent]) => {
      setTasks(storedTasks);
      setEnergy(storedEnergy);
      setCaptureDrafts(storedDrafts);
      setCalendarItems(storedCalendarItems.map((item) => (isDayKey(item.day) ? item : { ...item, day: resolveDayKey(item.day) })));
      setTheme(storedTheme);
      setRecentCaptures(storedRecent);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) saveTheme(theme);
  }, [hydrated, theme]);

  useEffect(() => {
    if (!undo) return;
    const timeout = setTimeout(() => setUndo(null), 5000);
    return () => clearTimeout(timeout);
  }, [undo]);

  useEffect(() => {
    if (hydrated) saveTasks(tasks);
  }, [hydrated, tasks]);

  useEffect(() => {
    if (hydrated) saveEnergy(energy);
  }, [energy, hydrated]);

  useEffect(() => {
    if (hydrated) saveCaptureDrafts(captureDrafts);
  }, [captureDrafts, hydrated]);

  useEffect(() => {
    if (hydrated) saveCalendarItems(calendarItems);
  }, [calendarItems, hydrated]);

  useEffect(() => {
    if (hydrated) saveRecentCaptures(recentCaptures);
  }, [hydrated, recentCaptures]);

  const syncGoogle = async () => {
    if (!google.accessToken) {
      if (!google.isConfigured) {
        setSyncMessage('add an Android Google client ID to mobile/.env.local');
        return;
      }
      await google.connect();
      return;
    }

    try {
      const [syncedEvents, syncedTasks] = await Promise.all([
        fetchGoogleCalendarItems(google.accessToken),
        fetchGoogleTasks(google.accessToken),
      ]);
      setCalendarItems([...syncedEvents, ...localCalendarItems]);
      setTasks((current) => [
        ...current.filter((task) => !task.id.startsWith('google-')),
        ...syncedTasks,
      ]);
      setSyncMessage(`synced ${syncedEvents.length} events, ${syncedTasks.length} tasks`);
    } catch (error) {
      setSyncMessage(error instanceof Error ? error.message : 'google sync failed');
    }
  };

  const completeTask = (id: string) => {
    let snapshot: Task | undefined;
    setTasks((current) => {
      snapshot = current.find((t) => t.id === id);
      return current.map((task) => (task.id === id ? { ...task, completed: true } : task));
    });
    if (snapshot) {
      setUndo({
        label: 'done · undo',
        apply: () => setTasks((current) => current.map((t) => (t.id === id ? { ...t, completed: false } : t))),
      });
    }
  };

  const deleteTask = (id: string) => {
    let snapshot: Task | undefined;
    let index = -1;
    setTasks((current) => {
      index = current.findIndex((t) => t.id === id);
      snapshot = current[index];
      return current.filter((t) => t.id !== id);
    });
    if (snapshot) {
      const restored = snapshot;
      const at = index;
      setUndo({
        label: 'removed · undo',
        apply: () => setTasks((current) => {
          const next = current.slice();
          next.splice(Math.max(0, at), 0, restored);
          return next;
        }),
      });
    }
  };

  const deleteCalendarItem = (id: string) => {
    let snapshot: CalendarItem | undefined;
    let index = -1;
    setCalendarItems((current) => {
      index = current.findIndex((t) => t.id === id);
      snapshot = current[index];
      return current.filter((t) => t.id !== id);
    });
    if (snapshot) {
      const restored = snapshot;
      const at = index;
      setUndo({
        label: 'removed · undo',
        apply: () => setCalendarItems((current) => {
          const next = current.slice();
          next.splice(Math.max(0, at), 0, restored);
          return next;
        }),
      });
    }
  };

  const touchTask = (id: string) => {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, touched: true } : task)));
  };

  const updateTask = (id: string, updates: Partial<Task>) => {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...updates } : task)));
  };

  const updateCalendarItem = (id: string, updates: Partial<CalendarItem>) => {
    setCalendarItems((current) => current.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const addTask = (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setTasks((current) => [
      { id: `task-${Date.now()}`, title: trimmed, bucket: 'today', energy: energy ?? 'ok', completed: false },
      ...current,
    ]);
  };

  const addCalendarItem = (item: { title: string; day: string; time: string }) => {
    const trimmed = item.title.trim();
    if (!trimmed) return;
    setCalendarItems((current) => [
      { id: `event-${Date.now()}`, title: trimmed, day: item.day, time: item.time, source: 'local' },
      ...current,
    ]);
  };

  const keepCaptureDraft = (draft: CaptureDraft) => {
    const title = draft.title.trim();
    if (title) {
      setRecentCaptures((current) => [title, ...current.filter((t) => t !== title)].slice(0, 8));
    }
    if (draft.kind === 'task') {
      setTasks((current) => [
        {
          id: `capture-task-${Date.now()}`,
          title: draft.title,
          bucket: 'today',
          energy: 'ok',
          completed: false,
        },
        ...current,
      ]);
      setSyncMessage('kept as a task for today');
      setScreen('today');
      return;
    }

    setCalendarItems((current) => [
      {
        id: `capture-event-${Date.now()}`,
        title: draft.title,
        day: resolveDayKey(draft.day),
        time: draft.time ?? '14:00',
        source: 'local',
      },
      ...current,
    ]);
    setSyncMessage('kept as a calendar event');
    setScreen('calendar');
  };

  return (
    <ThemeContext.Provider value={themeValue}>
    <SafeAreaView style={styles.root}>
      <View style={styles.shell}>
        <Header screen={screen} googleStatus={google.status} syncGoogle={syncGoogle} syncMessage={syncMessage} />
        <View style={styles.content}>
          {screen === 'capture' && (
            <CaptureScreen
              captureUri={captureUri}
              drafts={captureDrafts}
              setCaptureUri={setCaptureUri}
              setDrafts={setCaptureDrafts}
              keepDraft={keepCaptureDraft}
              recentCaptures={recentCaptures}
            />
          )}
          {screen === 'today' && (
            <TodayScreen
              energy={energy}
              laterCount={laterTasks.length}
              setEnergy={setEnergy}
              tasks={todayTasks}
              completeTask={completeTask}
              touchTask={touchTask}
              addTask={addTask}
              deleteTask={deleteTask}
              openEdit={(id) => setEditing({ kind: 'task', id })}
            />
          )}
          {screen === 'calendar' && (
            <CalendarScreen
              calendarItems={calendarItems}
              addCalendarItem={addCalendarItem}
              addTask={addTask}
              deleteCalendarItem={deleteCalendarItem}
              openEdit={(id) => setEditing({ kind: 'event', id })}
            />
          )}
          {screen === 'focus' && (
            <FocusScreen
              tasks={activeTasks}
              focusedTask={focusedTask}
              focusRunning={focusRunning}
              setFocusRunning={setFocusRunning}
              setFocusTaskId={setFocusTaskId}
              completeTask={completeTask}
              touchTask={touchTask}
            />
          )}
        </View>
        {undo && (
          <Pressable
            style={styles.undoToast}
            onPress={() => {
              undo.apply();
              setUndo(null);
            }}
          >
            <Ionicons name="arrow-undo-outline" size={14} color={palette.sageText} />
            <Text style={styles.undoToastText}>{undo.label}</Text>
          </Pressable>
        )}
        <ItemDetailModal
          editing={editing}
          tasks={tasks}
          calendarItems={calendarItems}
          close={() => setEditing(null)}
          updateTask={updateTask}
          updateCalendarItem={updateCalendarItem}
          deleteTask={(id) => {
            setEditing(null);
            deleteTask(id);
          }}
          deleteCalendarItem={(id) => {
            setEditing(null);
            deleteCalendarItem(id);
          }}
        />
        <BottomNav current={screen} setCurrent={setScreen} />
      </View>
    </SafeAreaView>
    </ThemeContext.Provider>
  );
}

function Header({
  screen,
  googleStatus,
  syncGoogle,
  syncMessage,
}: {
  screen: ScreenKey;
  googleStatus: string;
  syncGoogle: () => void;
  syncMessage: string;
}) {
  const { colors, theme, toggleTheme } = useTheme();
  const styles = useStyles();
  const title = screen === 'calendar' ? 'your week' : screen;

  return (
    <View style={styles.header}>
      <Pressable style={styles.headerIcon}>
        <Ionicons name="menu-outline" size={24} color={colors.mutedStrong} />
      </Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      <View style={styles.headerActions}>
        <Pressable style={styles.headerIconButton} onPress={toggleTheme}>
          <Ionicons name={theme === 'dark' ? 'sunny-outline' : 'moon-outline'} size={16} color={colors.mutedStrong} />
        </Pressable>
        <Pressable style={styles.avatar} onPress={syncGoogle}>
          <Ionicons name={googleStatus === 'connected' ? 'cloud-done-outline' : 'person-outline'} size={16} color={colors.sageText} />
        </Pressable>
      </View>
      {syncMessage ? <Text style={styles.syncToast}>{syncMessage}</Text> : null}
    </View>
  );
}

function BottomNav({
  current,
  setCurrent,
}: {
  current: ScreenKey;
  setCurrent: (screen: ScreenKey) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.navWrap}>
      {tabs.map((tab) => {
        const active = tab.key === current;
        return (
          <Pressable key={tab.key} onPress={() => setCurrent(tab.key)} style={styles.navItem}>
            <View style={[styles.navDot, active && styles.navDotActive]} />
            <Ionicons name={tab.icon} size={20} color={active ? colors.sageText : colors.mutedStrong} />
            <Text style={[styles.navLabel, active && styles.navLabelActive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function CaptureScreen({
  captureUri,
  drafts,
  setCaptureUri,
  setDrafts,
  keepDraft,
  recentCaptures,
}: {
  captureUri: string | null;
  drafts: CaptureDraft[];
  setCaptureUri: (uri: string | null) => void;
  setDrafts: React.Dispatch<React.SetStateAction<CaptureDraft[]>>;
  keepDraft: (draft: CaptureDraft) => void;
  recentCaptures: string[];
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const capturing = recorderState.isRecording;

  const removeDraft = (id: string) => {
    setDrafts((current) => current.filter((draft) => draft.id !== id));
  };

  const handleKeepDraft = (draft: CaptureDraft) => {
    keepDraft(draft);
    removeDraft(draft.id);
    setEditingDraftId(null);
  };

  const updateDraftTitle = (id: string, title: string) => {
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, title } : draft)));
  };

  const updateDraft = (id: string, updates: Partial<CaptureDraft>) => {
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, ...updates } : draft)));
  };

  const toggleRecording = async () => {
    if (capturing) {
      const durationSeconds = Math.max(1, Math.round(recorderState.durationMillis / 1000));
      await recorder.stop();
      const uri = recorder.uri;
      setCaptureUri(uri);
      setDrafts((current) => [
        {
          id: `recording-${Date.now()}`,
          kind: 'task',
          label: 'voice note - just now',
          title: `review ${durationSeconds}s voice note`,
          audioUri: uri ?? undefined,
          audioSeconds: durationSeconds,
        },
        ...current,
      ]);
      return;
    }

    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) return;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setCaptureUri(null);
  };

  return (
    <ScrollView contentContainerStyle={styles.capture} showsVerticalScrollIndicator={false}>
      <Text style={styles.microcopy}>a gentle mind dump</Text>
      <View style={styles.micRings}>
        <View style={styles.ringOuter} />
        <View style={styles.ringInner} />
        <Pressable
          onPress={toggleRecording}
          style={[styles.micButton, capturing && styles.micButtonActive]}
        >
          <Ionicons name={capturing ? 'stop' : 'mic-outline'} size={32} color={colors.ink} />
        </Pressable>
      </View>
      <Text style={styles.italicHelp}>
        {capturing ? `listening... ${Math.round(recorderState.durationMillis / 1000)}s` : 'tap and ramble. nothing is too small.'}
      </Text>
      {captureUri ? <Text style={styles.captureUri}>saved native recording - added to capture queue</Text> : null}

      <View style={styles.draftStack}>
        {drafts.length === 0 ? (
          <View style={styles.emptyDrafts}>
            <Ionicons name="checkmark-done-outline" size={24} color={colors.sageText} />
            <Text style={styles.emptyDraftsText}>capture queue is clear</Text>
          </View>
        ) : (
          drafts.map((draft) => (
            <DraftCard
              key={draft.id}
              draft={draft}
              editing={editingDraftId === draft.id}
              onStartEditing={() => setEditingDraftId(draft.id)}
              onStopEditing={() => setEditingDraftId(null)}
              onChangeTitle={(title) => updateDraftTitle(draft.id, title)}
              onChangeDraft={(updates) => updateDraft(draft.id, updates)}
              onKeep={() => handleKeepDraft(draft)}
              onDiscard={() => {
                removeDraft(draft.id);
                if (editingDraftId === draft.id) setEditingDraftId(null);
              }}
            />
          ))
        )}
      </View>

      {recentCaptures.length > 0 && (
        <View style={styles.thoughts}>
          <Text style={styles.sectionKicker}>recent captures</Text>
          {recentCaptures.map((thought, i) => (
            <Text key={`${i}-${thought}`} style={styles.thoughtText}>
              {thought}
            </Text>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function AudioPlayback({ uri, seconds }: { uri: string; seconds?: number }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const player = useAudioPlayer({ uri });
  const status = useAudioPlayerStatus(player);
  const playing = status.playing;

  const toggle = () => {
    if (playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish || (status.duration && status.currentTime >= status.duration)) {
      player.seekTo(0);
    }
    player.play();
  };

  return (
    <Pressable onPress={toggle} style={styles.playbackRow}>
      <Ionicons name={playing ? 'pause-circle' : 'play-circle'} size={22} color={colors.sageText} />
      <Text style={styles.playbackText}>
        {playing ? 'playing' : 'play'} · {seconds ?? Math.round(status.duration ?? 0)}s
      </Text>
    </Pressable>
  );
}

function DraftCard({
  draft,
  editing,
  onStartEditing,
  onStopEditing,
  onChangeTitle,
  onChangeDraft,
  onKeep,
  onDiscard,
}: {
  draft: CaptureDraft;
  editing: boolean;
  onStartEditing: () => void;
  onStopEditing: () => void;
  onChangeTitle: (title: string) => void;
  onChangeDraft: (updates: Partial<CaptureDraft>) => void;
  onKeep: () => void;
  onDiscard: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.draftCard}>
      <Text style={styles.sectionKicker}>{draft.label}</Text>
      {editing ? (
        <TextInput
          autoFocus
          value={draft.title}
          onChangeText={onChangeTitle}
          onBlur={onStopEditing}
          onSubmitEditing={onStopEditing}
          returnKeyType="done"
          style={styles.draftInput}
          placeholder="name this gently"
          placeholderTextColor={colors.muted}
        />
      ) : (
        <Pressable onPress={onStartEditing} style={styles.draftTitleRow}>
          <Text style={styles.cardTitle}>{draft.title}</Text>
          <Ionicons name="pencil-outline" size={15} color={colors.mutedStrong} />
        </Pressable>
      )}
      {draft.audioUri && <AudioPlayback uri={draft.audioUri} seconds={draft.audioSeconds} />}
      <View style={styles.draftTypeToggle}>
        {(['task', 'event'] as const).map((kind) => {
          const active = draft.kind === kind;
          return (
            <Pressable
              key={kind}
              onPress={() => onChangeDraft({
                kind,
                label: kind === 'task' ? 'task - today' : 'event - soon',
                day: kind === 'event' ? draft.day ?? 'Tomorrow' : undefined,
                time: kind === 'event' ? draft.time ?? '14:00' : undefined,
              })}
              style={[styles.draftTypeButton, active && styles.draftTypeButtonActive]}
            >
              <Ionicons
                name={kind === 'task' ? 'checkmark-done-outline' : 'calendar-clear-outline'}
                size={14}
                color={active ? colors.sageText : colors.mutedStrong}
              />
              <Text style={[styles.draftTypeText, active && styles.draftTypeTextActive]}>{kind}</Text>
            </Pressable>
          );
        })}
      </View>

      {draft.kind === 'event' && (
        <View style={styles.eventDraftFields}>
          <TextInput
            value={draft.day ?? ''}
            onChangeText={(day) => onChangeDraft({ day })}
            style={[styles.draftMetaInput, styles.draftDayInput]}
            placeholder="day"
            placeholderTextColor={colors.muted}
            returnKeyType="done"
          />
          <TextInput
            value={draft.time ?? ''}
            onChangeText={(time) => onChangeDraft({ time })}
            style={styles.draftMetaInput}
            placeholder="time"
            placeholderTextColor={colors.muted}
            returnKeyType="done"
          />
        </View>
      )}
      <View style={styles.draftActions}>
        <Pressable onPress={onKeep} disabled={!draft.title.trim()} style={[styles.keepButton, !draft.title.trim() && styles.disabledAction]}>
          <Ionicons name="checkmark-circle-outline" size={16} color={colors.sageText} />
          <Text style={styles.keepText}>keep it</Text>
        </Pressable>
        <Pressable onPress={onDiscard} style={styles.discardButton}>
          <Ionicons name="close-circle-outline" size={16} color={colors.mutedStrong} />
          <Text style={styles.discardText}>discard</Text>
        </Pressable>
      </View>
    </View>
  );
}

function TodayScreen({
  energy,
  laterCount,
  setEnergy,
  tasks,
  completeTask,
  touchTask,
  addTask,
  deleteTask,
  openEdit,
}: {
  energy: EnergyLevel | null;
  laterCount: number;
  setEnergy: (energy: EnergyLevel) => void;
  tasks: Task[];
  completeTask: (id: string) => void;
  touchTask: (id: string) => void;
  addTask: (title: string) => void;
  deleteTask: (id: string) => void;
  openEdit: (id: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [showInput, setShowInput] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const submit = () => {
    if (!newTitle.trim()) return;
    addTask(newTitle);
    setNewTitle('');
    setShowInput(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.today} showsVerticalScrollIndicator={false}>
      <View style={styles.todayHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>hello, andy</Text>
          <Text style={styles.subtle}>one thing at a time</Text>
        </View>
        <Pressable onPress={() => setShowInput((v) => !v)} style={styles.addButton}>
          <Ionicons name={showInput ? 'close' : 'add'} size={20} color={colors.sageText} />
        </Pressable>
      </View>

      {showInput && (
        <View style={styles.intentionForm}>
          <TextInput
            autoFocus
            value={newTitle}
            onChangeText={setNewTitle}
            onSubmitEditing={submit}
            returnKeyType="done"
            placeholder="what's on your mind?"
            placeholderTextColor={colors.muted}
            style={styles.intentionInput}
          />
          <Pressable onPress={submit} disabled={!newTitle.trim()} style={[styles.intentionSubmit, !newTitle.trim() && styles.disabledAction]}>
            <Text style={styles.intentionSubmitText}>keep</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.energyCard}>
        <Text style={styles.energyTitle}>how's your body right now?</Text>
        <View style={styles.energyRow}>
          {(['low', 'ok', 'sharp'] as EnergyLevel[]).map((level) => (
            <Pressable
              key={level}
              onPress={() => setEnergy(level)}
              style={[styles.energyPill, energy === level && styles.energyPillActive]}
            >
              <Text style={[styles.energyText, energy === level && styles.energyTextActive]}>{level}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.taskList}>
        {tasks.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="leaf-outline" size={22} color={colors.sageText} />
            <Text style={styles.emptyCardTitle}>the list is quiet</Text>
            <Text style={styles.emptyCardHint}>rest, or tap + to add a gentle intention.</Text>
          </View>
        ) : (
          tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              completeTask={completeTask}
              touchTask={touchTask}
              deleteTask={deleteTask}
              openEdit={openEdit}
            />
          ))
        )}
      </View>

      <Text style={styles.laterText}>later - {laterCount}</Text>
      <Text style={styles.doneText}>i'm done for today</Text>
    </ScrollView>
  );
}

function TaskRow({
  task,
  completeTask,
  touchTask,
  deleteTask,
  openEdit,
}: {
  task: Task;
  completeTask: (id: string) => void;
  touchTask: (id: string) => void;
  deleteTask?: (id: string) => void;
  openEdit?: (id: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.taskRow}>
      <Pressable onPress={() => completeTask(task.id)} style={styles.taskDot} hitSlop={10} />
      <Pressable onPress={() => openEdit?.(task.id)} style={{ flex: 1 }}>
        <Text style={styles.taskTitle}>{task.title}</Text>
      </Pressable>
      {task.touched && (
        <Pressable onPress={() => touchTask(task.id)} style={styles.touched}>
          <Text style={styles.touchedText}>touched</Text>
        </Pressable>
      )}
      {deleteTask && (
        <Pressable onPress={() => deleteTask(task.id)} style={styles.rowDelete} hitSlop={8}>
          <Ionicons name="close" size={14} color={colors.mutedStrong} />
        </Pressable>
      )}
    </View>
  );
}

function ItemDetailModal({
  editing,
  tasks,
  calendarItems,
  close,
  updateTask,
  updateCalendarItem,
  deleteTask,
  deleteCalendarItem,
}: {
  editing: { kind: 'task' | 'event'; id: string } | null;
  tasks: Task[];
  calendarItems: CalendarItem[];
  close: () => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  updateCalendarItem: (id: string, updates: Partial<CalendarItem>) => void;
  deleteTask: (id: string) => void;
  deleteCalendarItem: (id: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const source = useMemo(() => {
    if (!editing) return null;
    if (editing.kind === 'task') return tasks.find((t) => t.id === editing.id) ?? null;
    return calendarItems.find((c) => c.id === editing.id) ?? null;
  }, [editing, tasks, calendarItems]);

  const [title, setTitle] = useState('');
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [bucket, setBucket] = useState<'today' | 'later'>('today');

  useEffect(() => {
    if (!source || !editing) return;
    setTitle(source.title);
    if (editing.kind === 'event') {
      const item = source as CalendarItem;
      setDay(item.day);
      setTime(item.time);
    } else {
      setBucket((source as Task).bucket);
    }
  }, [editing, source]);

  if (!editing || !source) return null;

  const save = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    if (editing.kind === 'task') {
      updateTask(editing.id, { title: trimmed, bucket });
    } else {
      updateCalendarItem(editing.id, { title: trimmed, day: day.trim() || (source as CalendarItem).day, time: time.trim() || (source as CalendarItem).time });
    }
    close();
  };

  const today = new Date();
  const quickDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.modalBackdrop} onPress={close}>
        <Pressable style={styles.quickAddCard} onPress={() => {}}>
          <Text style={styles.quickAddKicker}>{editing.kind === 'task' ? 'intention' : 'event'}</Text>
          <Text style={styles.quickAddTitle}>edit gently</Text>

          <TextInput
            value={title}
            onChangeText={setTitle}
            style={styles.quickAddInput}
            placeholder="name it softly"
            placeholderTextColor={colors.muted}
            returnKeyType="done"
            onSubmitEditing={save}
          />

          {editing.kind === 'task' ? (
            <View style={styles.quickAddToggle}>
              {(['today', 'later'] as const).map((b) => {
                const active = bucket === b;
                return (
                  <Pressable key={b} onPress={() => setBucket(b)} style={[styles.quickAddPill, active && styles.quickAddPillActive]}>
                    <Text style={[styles.quickAddPillText, active && styles.quickAddPillTextActive]}>{b}</Text>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <>
              <View style={styles.dayPickerRow}>
                {quickDays.map((d) => {
                  const iso = dayKey(d);
                  const active = iso === day;
                  return (
                    <Pressable key={iso} onPress={() => setDay(iso)} style={[styles.dayPickerPill, active && styles.dayPickerPillActive]}>
                      <Text style={[styles.dayPickerLetter, active && styles.dayPickerTextActive]}>
                        {d.toLocaleDateString('en-US', { weekday: 'narrow' })}
                      </Text>
                      <Text style={[styles.dayPickerNum, active && styles.dayPickerTextActive]}>{d.getDate()}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.quickAddFieldRow}>
                <Text style={styles.quickAddLabel}>time</Text>
                <TextInput
                  value={time}
                  onChangeText={setTime}
                  style={styles.quickAddTimeInput}
                  placeholder="14:00"
                  placeholderTextColor={colors.muted}
                />
              </View>
            </>
          )}

          <Pressable onPress={save} disabled={!title.trim()} style={[styles.quickAddSubmit, !title.trim() && styles.disabledAction]}>
            <Text style={styles.quickAddSubmitText}>save</Text>
          </Pressable>
          <Pressable
            onPress={() => (editing.kind === 'task' ? deleteTask(editing.id) : deleteCalendarItem(editing.id))}
            style={styles.detailDeleteButton}
          >
            <Ionicons name="trash-outline" size={14} color={colors.mutedStrong} />
            <Text style={styles.detailDeleteText}>remove</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function CalendarScreen({
  calendarItems,
  addCalendarItem,
  addTask,
  deleteCalendarItem,
  openEdit,
}: {
  calendarItems: CalendarItem[];
  addCalendarItem: (item: { title: string; day: string; time: string }) => void;
  addTask: (title: string) => void;
  deleteCalendarItem: (id: string) => void;
  openEdit: (id: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [quickAddDay, setQuickAddDay] = useState<string | null>(null);
  const [selectedOffset, setSelectedOffset] = useState<number | null>(null);
  const [quickKind, setQuickKind] = useState<'event' | 'task'>('event');
  const [quickTitle, setQuickTitle] = useState('');
  const [quickTime, setQuickTime] = useState('14:00');

  const openQuickAdd = (isoDay: string) => {
    setQuickAddDay(isoDay);
    setQuickKind('event');
    setQuickTitle('');
    setQuickTime('14:00');
  };

  const submit = () => {
    if (!quickTitle.trim() || !quickAddDay) return;
    if (quickKind === 'task') addTask(quickTitle);
    else addCalendarItem({ title: quickTitle, day: quickAddDay, time: quickTime });
    setQuickAddDay(null);
  };

  const quickAddLabel = useMemo(() => {
    if (!quickAddDay) return '';
    const d = new Date(`${quickAddDay}T00:00:00`);
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  }, [quickAddDay]);

  const today = new Date();
  const todayIdx = (today.getDay() + 6) % 7;
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - todayIdx);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });
  const fullDayName = (d: Date) => d.toLocaleDateString('en-US', { weekday: 'long' });
  const activeIdx = selectedOffset ?? todayIdx;
  const sectionDays = selectedOffset === null
    ? weekDays.slice(todayIdx, todayIdx + 3)
    : [weekDays[selectedOffset]];

  return (
    <>
      <ScrollView contentContainerStyle={styles.calendar} showsVerticalScrollIndicator={false}>
        <View style={styles.weekStrip}>
          {weekDays.map((d, index) => {
            const active = index === activeIdx;
            const letter = d.toLocaleDateString('en-US', { weekday: 'narrow' });
            return (
              <Pressable
                key={d.toISOString()}
                onPress={() => setSelectedOffset(index === todayIdx ? null : index)}
                style={[styles.dayBubble, active && styles.dayBubbleActive]}
              >
                <Text style={styles.dayLetter}>{letter}</Text>
                <Text style={styles.dayNumber}>{d.getDate()}</Text>
              </Pressable>
            );
          })}
        </View>

        {sectionDays.map((d, i) => {
          const day = fullDayName(d);
          const iso = dayKey(d);
          const dIdx = (d.getDay() + 6) % 7;
          const heading = dIdx === todayIdx
            ? `today · ${day.toLowerCase()}`
            : dIdx === todayIdx + 1
            ? `tomorrow · ${day.toLowerCase()}`
            : day.toLowerCase();
          const dayItems = calendarItems.filter((item) => item.day === iso);
          return (
            <View key={d.toISOString()} style={styles.daySection}>
              <View style={styles.dayHeaderRow}>
                <Text style={styles.dayHeading}>{heading}</Text>
                <Pressable onPress={() => openQuickAdd(iso)} style={styles.dayAddButton}>
                  <Ionicons name="add" size={16} color={colors.sageText} />
                </Pressable>
              </View>
              {dayItems.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons name="cloud-outline" size={20} color={colors.sageText} />
                  <Text style={styles.emptyCardTitle}>nothing scheduled</Text>
                  <Text style={styles.emptyCardHint}>a soft day — that's ok.</Text>
                </View>
              ) : (
                dayItems.map((item) => (
                  <View key={item.id} style={styles.eventCard}>
                    <Pressable onPress={() => openEdit(item.id)} style={{ flex: 1 }}>
                      <Text style={styles.eventTime}>{item.time}</Text>
                      <Text style={styles.eventTitle}>{item.title}</Text>
                    </Pressable>
                    <Pressable onPress={() => deleteCalendarItem(item.id)} style={styles.rowDelete} hitSlop={8}>
                      <Ionicons name="close" size={14} color={colors.mutedStrong} />
                    </Pressable>
                  </View>
                ))
              )}
            </View>
          );
        })}

        <View style={styles.calendarOrb}>
          <View style={styles.orb} />
        </View>
      </ScrollView>

      <Modal visible={quickAddDay !== null} transparent animationType="fade" onRequestClose={() => setQuickAddDay(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setQuickAddDay(null)}>
          <Pressable style={styles.quickAddCard} onPress={() => {}}>
            <Text style={styles.quickAddKicker}>{quickAddLabel}</Text>
            <Text style={styles.quickAddTitle}>quick add</Text>

            <View style={styles.quickAddToggle}>
              {(['event', 'task'] as const).map((kind) => {
                const active = quickKind === kind;
                return (
                  <Pressable key={kind} onPress={() => setQuickKind(kind)} style={[styles.quickAddPill, active && styles.quickAddPillActive]}>
                    <Text style={[styles.quickAddPillText, active && styles.quickAddPillTextActive]}>{kind}</Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              autoFocus
              value={quickTitle}
              onChangeText={setQuickTitle}
              placeholder={quickKind === 'event' ? 'what is happening?' : 'what do you want to keep?'}
              placeholderTextColor={colors.muted}
              style={styles.quickAddInput}
              returnKeyType="done"
              onSubmitEditing={submit}
            />

            {quickKind === 'event' && (
              <View style={styles.quickAddFieldRow}>
                <Text style={styles.quickAddLabel}>time</Text>
                <TextInput
                  value={quickTime}
                  onChangeText={setQuickTime}
                  style={styles.quickAddTimeInput}
                  placeholder="14:00"
                  placeholderTextColor={colors.muted}
                />
              </View>
            )}

            <Pressable onPress={submit} disabled={!quickTitle.trim()} style={[styles.quickAddSubmit, !quickTitle.trim() && styles.disabledAction]}>
              <Text style={styles.quickAddSubmitText}>{quickKind === 'event' ? 'add to schedule' : 'keep as task'}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function FocusScreen({
  tasks,
  focusedTask,
  focusRunning,
  setFocusRunning,
  setFocusTaskId,
  completeTask,
  touchTask,
}: {
  tasks: Task[];
  focusedTask: Task | null;
  focusRunning: boolean;
  setFocusRunning: (running: boolean) => void;
  setFocusTaskId: (id: string) => void;
  completeTask: (id: string) => void;
  touchTask: (id: string) => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [hideTimer, setHideTimer] = useState(false);

  useEffect(() => {
    setRemainingSeconds(25 * 60);
    setFocusRunning(false);
  }, [focusedTask?.id, setFocusRunning]);

  useEffect(() => {
    if (!focusRunning) return;
    const interval = setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          setFocusRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [focusRunning, setFocusRunning]);

  if (!focusedTask) {
    return (
      <View style={styles.centered}>
        <Text style={styles.italicHelp}>nothing on deck. that's ok.</Text>
      </View>
    );
  }

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const displayTime = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  const progressWidth = `${Math.max(0, Math.min(100, ((25 * 60 - remainingSeconds) / (25 * 60)) * 100))}%` as DimensionValue;

  return (
    <ScrollView contentContainerStyle={styles.focus} showsVerticalScrollIndicator={false}>
      <View style={styles.focusTop}>
        <Ionicons name="close-outline" size={24} color={colors.mutedStrong} />
        <View style={styles.togetherRow}>
          <View style={styles.togetherDot} />
          <Text style={styles.togetherText}>together</Text>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      <Text style={styles.intentLabel}>current intention</Text>
      <Text style={styles.focusTitle}>{focusedTask.title}</Text>
      <Pressable onPress={() => setFocusRunning(!focusRunning)} style={styles.focusOrb}>
        {hideTimer ? (
          <Ionicons name={focusRunning ? 'pause' : 'play'} size={42} color={colors.mutedStrong} />
        ) : (
          <Text style={styles.focusTime}>{displayTime}</Text>
        )}
      </Pressable>

      <Pressable onPress={() => setFocusRunning(!focusRunning)} style={styles.pauseButton}>
        <Text style={styles.pauseText}>{focusRunning ? 'pause' : 'start'}</Text>
      </Pressable>

      <View style={styles.focusActions}>
        <Pressable onPress={() => setHideTimer((current) => !current)} style={styles.focusAction}>
          <Ionicons name={hideTimer ? 'eye-outline' : 'eye-off-outline'} size={18} color={colors.mutedStrong} />
          <Text style={styles.actionText}>{hideTimer ? 'show timer' : 'hide timer'}</Text>
        </Pressable>
        <Pressable onPress={() => touchTask(focusedTask.id)} style={styles.focusAction}>
          <Ionicons name="hand-left-outline" size={18} color={colors.mutedStrong} />
          <Text style={styles.actionText}>touched it</Text>
        </Pressable>
        <Pressable onPress={() => completeTask(focusedTask.id)} style={styles.focusAction}>
          <Ionicons name="checkmark-circle-outline" size={18} color={colors.mutedStrong} />
          <Text style={styles.actionText}>done</Text>
        </Pressable>
      </View>

      <View style={styles.pickList}>
        {tasks.slice(0, 3).map((task) => (
          <Pressable key={task.id} onPress={() => setFocusTaskId(task.id)} style={styles.pickItem}>
            <Text style={styles.pickText}>{task.title}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.paperDeep,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 0,
  },
  shell: {
    flex: 1,
    backgroundColor: colors.paper,
  },
  header: {
    height: 54,
    borderBottomColor: colors.faint,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    flexDirection: 'row',
  },
  headerIcon: {
    minWidth: 38,
    height: 32,
    justifyContent: 'center',
  },
  headerIconText: {
    color: colors.ink,
    opacity: 0.62,
    fontSize: 11,
  },
  headerTitle: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 17,
    fontStyle: 'italic',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.sageSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.sageText,
    fontSize: 12,
    fontWeight: '700',
  },
  syncToast: {
    position: 'absolute',
    right: 14,
    top: 48,
    maxWidth: 210,
    color: colors.muted,
    fontSize: 10,
    textAlign: 'right',
  },
  content: {
    flex: 1,
    paddingHorizontal: 18,
  },
  undoToast: {
    position: 'absolute',
    bottom: 90,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.faint,
    borderWidth: StyleSheet.hairlineWidth,
    ...shadow,
  },
  undoToastText: {
    color: colors.sageText,
    fontSize: 11,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
  },
  emptyCard: {
    borderRadius: 18,
    borderColor: colors.sageBorder,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.surfaceSoft,
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 6,
  },
  emptyCardTitle: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 14,
    marginTop: 4,
  },
  emptyCardHint: {
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center',
  },
  rowDelete: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.5,
  },
  navWrap: {
    position: 'absolute',
    left: 28,
    right: 28,
    bottom: 16,
    height: 60,
    borderRadius: 20,
    backgroundColor: colors.paper,
    borderColor: colors.sageBorder,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    shadowColor: '#342b22',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 7 },
    elevation: 3,
  },
  navItem: {
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingTop: 4,
  },
  navDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    opacity: 0,
    backgroundColor: colors.sageText,
  },
  navDotActive: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 10,
    color: colors.mutedStrong,
  },
  navLabelActive: {
    color: colors.sageText,
  },
  capture: {
    minHeight: '100%',
    paddingTop: 12,
    paddingBottom: 96,
    alignItems: 'center',
  },
  microcopy: {
    alignSelf: 'flex-start',
    color: colors.muted,
    fontSize: 9,
    letterSpacing: 2,
  },
  micRings: {
    width: 210,
    height: 210,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 30,
  },
  ringOuter: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderColor: colors.faint,
    borderWidth: StyleSheet.hairlineWidth,
  },
  ringInner: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    borderColor: colors.faint,
    borderWidth: StyleSheet.hairlineWidth,
  },
  micButton: {
    width: 126,
    height: 126,
    borderRadius: 63,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sageFill3,
  },
  micButtonActive: {
    backgroundColor: colors.clayActive,
  },
  micGlyph: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
  },
  italicHelp: {
    color: colors.ink,
    opacity: 0.58,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 13,
    textAlign: 'center',
  },
  captureUri: {
    marginTop: 8,
    color: colors.sageText,
    fontSize: 10,
  },
  draftStack: {
    width: '100%',
    gap: 12,
    marginTop: 40,
  },
  emptyDrafts: {
    minHeight: 94,
    borderRadius: 18,
    borderColor: colors.sageBorder,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyDraftsText: {
    color: colors.sageText,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 13,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderColor: colors.faint,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    ...shadow,
  },
  draftCard: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: 18,
    borderColor: colors.sageBorder,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 15,
    paddingBottom: 14,
    shadowColor: '#342b22',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  sectionKicker: {
    color: colors.muted,
    fontSize: 8,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  cardTitle: {
    marginTop: 8,
    color: colors.ink,
    fontSize: 13,
    flex: 1,
    lineHeight: 19,
  },
  draftTitleRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  draftInput: {
    marginTop: 6,
    minHeight: 38,
    borderRadius: 12,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 14,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  playbackRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.sageFill1,
  },
  playbackText: {
    color: colors.sageText,
    fontSize: 11,
  },
  draftTypeToggle: {
    marginTop: 13,
    flexDirection: 'row',
    gap: 8,
  },
  draftTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    borderColor: colors.sageBorder,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 11,
    paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  draftTypeButtonActive: {
    backgroundColor: colors.sageFill1,
    borderColor: colors.sageBorder,
  },
  draftTypeText: {
    color: colors.mutedStrong,
    fontSize: 10,
  },
  draftTypeTextActive: {
    color: colors.sageText,
    fontWeight: '700',
  },
  eventDraftFields: {
    marginTop: 10,
    flexDirection: 'row',
    gap: 8,
  },
  draftMetaInput: {
    minHeight: 34,
    minWidth: 78,
    borderRadius: 12,
    backgroundColor: colors.surface,
    color: colors.ink,
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  draftDayInput: {
    flex: 1,
  },
  disabledAction: {
    opacity: 0.38,
  },
  draftActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    alignItems: 'center',
  },
  keepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.sageFill2,
  },
  keepText: {
    color: colors.sageText,
    fontSize: 10,
    fontWeight: '700',
  },
  discardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  discardText: {
    color: colors.muted,
    fontSize: 10,
  },
  thoughts: {
    width: '100%',
    marginTop: 22,
    gap: 9,
  },
  thoughtText: {
    color: colors.muted,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 12,
  },
  today: {
    minHeight: '100%',
    paddingTop: 16,
    paddingBottom: 96,
  },
  greeting: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 22,
  },
  subtle: {
    color: colors.muted,
    marginTop: 6,
    fontSize: 12,
  },
  energyCard: {
    marginTop: 28,
    backgroundColor: colors.card,
    borderColor: colors.faint,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
  },
  energyTitle: {
    color: colors.ink,
    opacity: 0.72,
    fontSize: 12,
    marginBottom: 12,
  },
  energyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  energyPill: {
    minWidth: 76,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderColor: colors.faint,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  energyPillActive: {
    backgroundColor: colors.sageFill1,
    borderColor: colors.sageFill3,
  },
  energyText: {
    color: colors.muted,
    fontSize: 10,
  },
  energyTextActive: {
    color: colors.sageText,
    fontWeight: '700',
  },
  taskList: {
    marginTop: 24,
    gap: 12,
  },
  taskRow: {
    minHeight: 48,
    borderRadius: 17,
    backgroundColor: colors.card,
    borderColor: colors.faint,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  taskDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.sageText,
  },
  taskTitle: {
    color: colors.ink,
    fontSize: 13,
    flex: 1,
  },
  touched: {
    borderRadius: radii.pill,
    paddingHorizontal: 9,
    paddingVertical: 4,
    backgroundColor: colors.sageFill1,
  },
  touchedText: {
    color: colors.sageText,
    fontSize: 8,
    textTransform: 'uppercase',
  },
  laterText: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 11,
    marginTop: 20,
  },
  doneText: {
    textAlign: 'center',
    color: colors.muted,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 12,
    marginTop: 20,
  },
  calendar: {
    paddingTop: 10,
    paddingBottom: 96,
  },
  weekStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomColor: colors.faint,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 13,
  },
  dayBubble: {
    width: 40,
    height: 52,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dayBubbleActive: {
    backgroundColor: colors.sageFill2,
  },
  dayLetter: {
    color: colors.muted,
    fontSize: 8,
  },
  dayNumber: {
    color: colors.ink,
    opacity: 0.56,
    fontSize: 10,
  },
  daySection: {
    marginTop: 26,
    gap: 10,
  },
  dayHeading: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 15,
  },
  eventCard: {
    minHeight: 64,
    borderRadius: 17,
    borderColor: colors.faint,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 15,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  eventTime: {
    color: colors.sageText,
    fontSize: 9,
  },
  eventTitle: {
    color: colors.ink,
    fontSize: 12,
    marginTop: 5,
  },
  emptyDay: {
    color: colors.muted,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 18,
    fontSize: 12,
  },
  calendarOrb: {
    height: 92,
    borderRadius: 10,
    marginTop: 26,
    backgroundColor: colors.orb,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  orb: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surface,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  focus: {
    minHeight: '100%',
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 96,
  },
  focusTop: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeText: {
    color: colors.muted,
    fontSize: 16,
  },
  togetherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  togetherDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.sageText,
  },
  togetherText: {
    color: colors.muted,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 11,
  },
  progressTrack: {
    width: 150,
    height: 2,
    backgroundColor: colors.faint,
    marginTop: 58,
  },
  progressFill: {
    height: 2,
    width: '24%',
    backgroundColor: colors.sageText,
  },
  intentLabel: {
    color: colors.muted,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 12,
    marginTop: 22,
  },
  focusTitle: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontSize: 20,
    textAlign: 'center',
    lineHeight: 28,
    marginTop: 18,
    maxWidth: 260,
  },
  focusOrb: {
    width: 238,
    height: 238,
    borderRadius: 119,
    backgroundColor: colors.surface,
    borderColor: colors.faint,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  focusTime: {
    color: colors.ink,
    opacity: 0.58,
    fontFamily: 'Georgia',
    fontSize: 36,
  },
  pauseButton: {
    marginTop: 30,
    minWidth: 92,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.faint,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  pauseText: {
    color: colors.ink,
    opacity: 0.62,
    fontSize: 11,
  },
  focusActions: {
    marginTop: 22,
    flexDirection: 'row',
    gap: 18,
  },
  focusAction: {
    alignItems: 'center',
    gap: 5,
    minWidth: 72,
  },
  actionText: {
    color: colors.muted,
    fontSize: 10,
  },
  pickList: {
    width: '100%',
    gap: 8,
    marginTop: 26,
  },
  pickItem: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: colors.surface,
  },
  pickText: {
    color: colors.muted,
    fontSize: 12,
  },
  todayHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  addButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.sageFill1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intentionForm: {
    marginTop: 18,
    backgroundColor: colors.card,
    borderColor: colors.faint,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.card,
    padding: 14,
    gap: 10,
  },
  intentionInput: {
    color: colors.ink,
    fontSize: 15,
    paddingVertical: 6,
  },
  intentionSubmit: {
    alignSelf: 'flex-end',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.sageFill2,
  },
  intentionSubmitText: {
    color: colors.sageText,
    fontSize: 12,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayAddButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.sageFill1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: colors.backdrop,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  quickAddCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.paper,
    borderRadius: 24,
    borderColor: colors.faint,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 22,
    ...shadow,
  },
  quickAddKicker: {
    color: colors.muted,
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'lowercase',
    marginBottom: 4,
  },
  quickAddTitle: {
    color: colors.ink,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 22,
    marginBottom: 18,
  },
  quickAddToggle: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  quickAddPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
  },
  quickAddPillActive: {
    backgroundColor: colors.sageFill2,
  },
  quickAddPillText: {
    color: colors.mutedStrong,
    fontSize: 12,
  },
  quickAddPillTextActive: {
    color: colors.ink,
  },
  quickAddInput: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 14,
    marginBottom: 14,
  },
  quickAddFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  quickAddLabel: {
    color: colors.muted,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontSize: 12,
    width: 42,
  },
  quickAddTimeInput: {
    flex: 1,
    backgroundColor: colors.surfaceSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink,
    fontSize: 13,
  },
  quickAddSubmit: {
    marginTop: 6,
    paddingVertical: 12,
    borderRadius: radii.pill,
    backgroundColor: colors.sageFill2,
    alignItems: 'center',
  },
  quickAddSubmitText: {
    color: colors.ink,
    fontSize: 13,
  },
  dayPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  dayPickerPill: {
    width: 38,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: colors.surfaceSoft,
  },
  dayPickerPillActive: {
    backgroundColor: colors.sageFill2,
  },
  dayPickerLetter: {
    color: colors.muted,
    fontSize: 9,
  },
  dayPickerNum: {
    color: colors.ink,
    opacity: 0.6,
    fontSize: 11,
  },
  dayPickerTextActive: {
    color: colors.sageText,
    opacity: 1,
    fontWeight: '700',
  },
  detailDeleteButton: {
    marginTop: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  detailDeleteText: {
    color: colors.muted,
    fontSize: 11,
  },
});
