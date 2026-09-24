import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
} from "react";
import { toPng } from "html-to-image";
import {
  AlertTriangle,
  ArrowDownToLine,
  BookOpenCheck,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Download,
  FileDown,
  FileUp,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import {
  COURSE_COLORS,
  createId,
  formatWeeks,
  getConflictIds,
  isTime,
  loadSchedule,
  parseScheduleData,
  parseWeeks,
  STORAGE_KEY,
  timeToMinutes,
  type Course,
  type Meeting,
  type Period,
  type ScheduleData,
} from "./model";
import { DAY_NAMES, TimetableBoard } from "./TimetableBoard";
import "./App.css";

type MeetingDraft = Omit<Meeting, "weeks"> & { weeksText: string };
type CourseDraft = Omit<Course, "meetings"> & { meetings: MeetingDraft[] };

function newMeeting(
  totalWeeks: number,
  day = 1,
  startPeriod = 1,
  endPeriod = 2,
): MeetingDraft {
  return {
    id: createId(),
    day,
    startPeriod,
    endPeriod,
    weeksText: `1-${totalWeeks}`,
  };
}

function newCourseDraft(data: ScheduleData): CourseDraft {
  return {
    id: createId(),
    name: "",
    teacher: "",
    location: "",
    color: COURSE_COLORS[0].value,
    meetings: [
      newMeeting(
        data.settings.totalWeeks,
        1,
        1,
        Math.min(2, data.settings.periods.length),
      ),
    ],
  };
}

function toCourseDraft(course: Course, totalWeeks: number): CourseDraft {
  return {
    ...course,
    meetings: course.meetings.map((meeting) => ({
      ...meeting,
      weeksText: formatWeeks(meeting.weeks, totalWeeks),
    })),
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function safeFilename(value: string) {
  return (
    value
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-") || "我的课表"
  );
}

function App() {
  const initial = useMemo(() => loadSchedule(), []);
  const [data, setData] = useState<ScheduleData>(initial.data);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">(
    "saved",
  );
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CourseDraft | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [notice, setNotice] = useState(
    initial.failed
      ? "本机保存的数据无法读取，已打开一张空课表。导入备份可以恢复课程。"
      : "",
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [weekError, setWeekError] = useState("");
  const exportRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSaveState("saving");
    const timeout = window.setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [data]);

  const conflictIds = useMemo(
    () => getConflictIds(data.courses),
    [data.courses],
  );
  const conflictCount = conflictIds.size;
  const sessionCount = data.courses.reduce(
    (count, course) => count + course.meetings.length,
    0,
  );
  const invalidPeriod = data.settings.periods.find(
    (period) =>
      !isTime(period.start) ||
      !isTime(period.end) ||
      timeToMinutes(period.start) >= timeToMinutes(period.end),
  );

  function updateSettings(
    update: (settings: ScheduleData["settings"]) => ScheduleData["settings"],
  ) {
    setData((current) => ({ ...current, settings: update(current.settings) }));
  }

  function startNewCourse() {
    if (draftDirty && !window.confirm("放弃尚未保存的课程修改？")) return;
    setSelectedCourseId(null);
    setDraft(newCourseDraft(data));
    setDraftDirty(false);
    setWeekError("");
    setNotice("");
  }

  function selectCourse(courseId: string) {
    if (draftDirty && !window.confirm("放弃尚未保存的课程修改？")) return;
    const course = data.courses.find((item) => item.id === courseId);
    if (!course) return;
    setSelectedCourseId(courseId);
    setDraft(toCourseDraft(course, data.settings.totalWeeks));
    setDraftDirty(false);
    setWeekError("");
    setNotice("");
  }

  function changeDraft<K extends keyof Omit<CourseDraft, "meetings">>(
    key: K,
    value: CourseDraft[K],
  ) {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setDraftDirty(true);
  }

  function changeMeeting(
    index: number,
    key: keyof MeetingDraft,
    value: string | number,
  ) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        meetings: current.meetings.map((meeting, meetingIndex) =>
          meetingIndex === index ? { ...meeting, [key]: value } : meeting,
        ),
      };
    });
    setDraftDirty(true);
    setWeekError("");
  }

  function addMeeting() {
    if (!draft) return;
    setDraft({
      ...draft,
      meetings: [
        ...draft.meetings,
        newMeeting(
          data.settings.totalWeeks,
          1,
          1,
          Math.min(2, data.settings.periods.length),
        ),
      ],
    });
    setDraftDirty(true);
  }

  function removeMeeting(index: number) {
    if (!draft || draft.meetings.length <= 1) return;
    setDraft({
      ...draft,
      meetings: draft.meetings.filter(
        (_, meetingIndex) => meetingIndex !== index,
      ),
    });
    setDraftDirty(true);
  }

  function saveCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) {
      setWeekError("先填写课程名称。");
      return;
    }
    const meetings: Meeting[] = [];
    for (const [index, meeting] of draft.meetings.entries()) {
      const weeks = parseWeeks(meeting.weeksText, data.settings.totalWeeks);
      if (!weeks) {
        setWeekError(
          `第 ${index + 1} 条安排的周次格式不正确，请检查后再保存。`,
        );
        return;
      }
      if (meeting.startPeriod > meeting.endPeriod) {
        setWeekError(`第 ${index + 1} 条安排的结束节次不能早于开始节次。`);
        return;
      }
      meetings.push({
        id: meeting.id,
        day: meeting.day,
        startPeriod: meeting.startPeriod,
        endPeriod: meeting.endPeriod,
        weeks,
      });
    }
    const course: Course = {
      id: draft.id,
      name,
      teacher: draft.teacher.trim(),
      location: draft.location.trim(),
      color: draft.color,
      meetings,
    };
    setData((current) => ({
      ...current,
      courses: current.courses.some((item) => item.id === course.id)
        ? current.courses.map((item) => (item.id === course.id ? course : item))
        : [...current.courses, course],
    }));
    setSelectedCourseId(course.id);
    setDraft(toCourseDraft(course, data.settings.totalWeeks));
    setDraftDirty(false);
    setWeekError("");
    setNotice("课程已保存。");
  }

  function deleteCourse() {
    if (!draft || !data.courses.some((course) => course.id === draft.id))
      return;
    const confirmed = window.confirm(
      `删除“${draft.name || "这门课程"}”及其所有上课安排？`,
    );
    if (!confirmed) return;
    setData((current) => ({
      ...current,
      courses: current.courses.filter((course) => course.id !== draft.id),
    }));
    setDraft(null);
    setSelectedCourseId(null);
    setDraftDirty(false);
    setNotice("课程已删除。");
  }

  function addPeriod() {
    if (data.settings.periods.length >= 16) {
      setNotice("最多可以设置 16 节课。");
      return;
    }
    const nextIndex = data.settings.periods.length + 1;
    const period: Period = { id: createId(), start: "18:20", end: "19:05" };
    updateSettings((settings) => ({
      ...settings,
      periods: [...settings.periods, period],
    }));
    setNotice(`已添加第 ${nextIndex} 节，请设置开始和结束时间。`);
  }

  function removeLastPeriod() {
    if (data.settings.periods.length <= 1) return;
    const lastIndex = data.settings.periods.length;
    if (
      data.courses.some((course) =>
        course.meetings.some((meeting) => meeting.endPeriod >= lastIndex),
      )
    ) {
      setNotice("有课程安排使用了最后一节，请先修改这些安排，再删除这一节。");
      return;
    }
    updateSettings((settings) => ({
      ...settings,
      periods: settings.periods.slice(0, -1),
    }));
    setNotice("已删除最后一节。");
  }

  function changeTotalWeeks(nextWeeks: number) {
    if (!Number.isInteger(nextWeeks) || nextWeeks < 1 || nextWeeks > 60) return;
    const highestUsedWeek = Math.max(
      0,
      ...data.courses.flatMap((course) =>
        course.meetings.flatMap((meeting) => meeting.weeks),
      ),
    );
    if (nextWeeks < highestUsedWeek) {
      setNotice(
        `已有课程排到第 ${highestUsedWeek} 周，不能把学期长度改得更短。`,
      );
      return;
    }
    updateSettings((settings) => ({ ...settings, totalWeeks: nextWeeks }));
    setNotice("学期周数已更新。");
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    downloadBlob(blob, `${safeFilename(data.settings.title)}-备份.json`);
    setNotice("课表备份已下载。");
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = parseScheduleData(
        JSON.parse(await file.text()) as unknown,
      );
      if (!parsed) {
        setNotice("这个 JSON 文件不是有效的课表备份。");
        return;
      }
      if (
        data.courses.length &&
        !window.confirm("导入会替换当前课表，继续吗？")
      )
        return;
      setData(parsed);
      setDraft(null);
      setSelectedCourseId(null);
      setDraftDirty(false);
      setShowSettings(false);
      setNotice("课表备份已导入。");
    } catch {
      setNotice("文件无法读取，请选择有效的 JSON 备份。");
    }
  }

  async function createPngPreview() {
    const node = exportRef.current;
    if (!node) return;
    setIsExporting(true);
    setNotice("");
    try {
      await document.fonts?.ready;
      const image = await toPng(node, {
        pixelRatio: 3,
        cacheBust: true,
        backgroundColor: "#dce6f5",
      });
      setPreviewUrl(image);
    } catch {
      setNotice("PNG 生成失败，请刷新页面后再试。");
    } finally {
      setIsExporting(false);
    }
  }

  function downloadPng() {
    if (!previewUrl) return;
    const anchor = document.createElement("a");
    anchor.href = previewUrl;
    anchor.download = `${safeFilename(data.settings.title)}.png`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setNotice("PNG 图片已保存到下载目录。");
  }

  const isEditingExisting = Boolean(
    draft && data.courses.some((course) => course.id === draft.id),
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="课表工坊首页">
          <span className="brand-mark">
            <CalendarDays aria-hidden="true" />
          </span>
          <span className="brand-copy">
            <strong>课表工坊</strong>
            <small>把一学期，排得明明白白</small>
          </span>
        </a>
        <div className="topbar-actions">
          <button
            className="button button--quiet"
            type="button"
            onClick={() => setShowSettings((shown) => !shown)}
            aria-expanded={showSettings}
            aria-label="课表设置"
          >
            <Settings2 size={17} aria-hidden="true" />
            <span>课表设置</span>
          </button>
          <div className="backup-actions">
            <button
              className="button button--quiet backup-main"
              type="button"
              onClick={exportBackup}
              aria-label="下载 JSON 备份"
            >
              <FileDown size={17} aria-hidden="true" />
              <span>备份</span>
            </button>
            <button
              className="button button--quiet backup-import"
              type="button"
              onClick={() => importRef.current?.click()}
              aria-label="导入 JSON 备份"
            >
              <FileUp size={17} aria-hidden="true" />
              <span>恢复</span>
            </button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={importBackup}
            />
          </div>
          <button
            className="button button--primary"
            type="button"
            onClick={createPngPreview}
            disabled={
              !data.courses.length || isExporting || Boolean(invalidPeriod)
            }
          >
            {isExporting ? (
              <span className="button-spinner" aria-hidden="true" />
            ) : (
              <Download size={17} aria-hidden="true" />
            )}
            <span>{isExporting ? "正在生成" : "导出 PNG"}</span>
          </button>
        </div>
      </header>

      <section className="intro-row" id="top">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            学期总览
          </div>
          <h1>安排好每一节课。</h1>
          <p className="intro-copy">
            录入课程和周次，生成一张随时能看的手机课表。
          </p>
        </div>
        <div className="save-indicator" aria-live="polite">
          <span
            className={`save-indicator__dot save-indicator__dot--${saveState}`}
          />
          {saveState === "saving"
            ? "正在保存"
            : saveState === "error"
              ? "保存失败"
              : "已保存到此浏览器"}
        </div>
      </section>

      {showSettings && (
        <section className="settings-panel" aria-labelledby="settings-heading">
          <div className="settings-heading-row">
            <div>
              <h2 id="settings-heading">课表设置</h2>
              <p>设置导出标题、学期名称、周数和每天的上课时间。</p>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="关闭课表设置"
              onClick={() => setShowSettings(false)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="settings-fields">
            <label className="field">
              <span>课表标题</span>
              <input
                value={data.settings.title}
                maxLength={24}
                onChange={(event) =>
                  updateSettings((settings) => ({
                    ...settings,
                    title: event.target.value,
                  }))
                }
                placeholder="我的课表"
              />
            </label>
            <label className="field">
              <span>
                学期名称 <small>可选</small>
              </span>
              <input
                value={data.settings.semester}
                maxLength={28}
                onChange={(event) =>
                  updateSettings((settings) => ({
                    ...settings,
                    semester: event.target.value,
                  }))
                }
                placeholder="例如：2026 秋季学期"
              />
            </label>
            <label className="field field--narrow">
              <span>学期周数</span>
              <div className="input-suffix">
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={data.settings.totalWeeks}
                  onChange={(event) =>
                    changeTotalWeeks(event.currentTarget.valueAsNumber)
                  }
                />
                <span>周</span>
              </div>
            </label>
          </div>
          <div className="density-setting">
            <div className="density-setting__heading">
              <label htmlFor="row-height-setting">每节课表高度</label>
              <output htmlFor="row-height-setting">
                {data.settings.rowHeight}px / 节
              </output>
            </div>
            <p>编辑预览和导出图片使用相同高度。</p>
            <input
              id="row-height-setting"
              type="range"
              min={68}
              max={118}
              step={2}
              value={data.settings.rowHeight}
              aria-valuetext={`${data.settings.rowHeight} 像素每节`}
              onChange={(event) =>
                updateSettings((settings) => ({
                  ...settings,
                  rowHeight: Number(event.target.value),
                }))
              }
            />
            <div className="density-setting__scale">
              <span>紧凑 · 68px</span>
              <span>舒展 · 118px</span>
            </div>
          </div>
          <div className="period-settings">
            <div className="period-settings__title">
              <span>每天的节次时间</span>
              <small>左侧会显示每节的完整时间段</small>
            </div>
            <div className="period-settings__list">
              {data.settings.periods.map((period, index) => (
                <div className="period-settings__item" key={period.id}>
                  <span className="period-settings__number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <label>
                    <span className="visually-hidden">
                      第 {index + 1} 节开始时间
                    </span>
                    <input
                      aria-label={`第 ${index + 1} 节开始时间`}
                      type="time"
                      value={period.start}
                      onChange={(event) =>
                        updateSettings((settings) => ({
                          ...settings,
                          periods: settings.periods.map((item) =>
                            item.id === period.id
                              ? { ...item, start: event.target.value }
                              : item,
                          ),
                        }))
                      }
                    />
                  </label>
                  <span className="period-settings__to">至</span>
                  <label>
                    <span className="visually-hidden">
                      第 {index + 1} 节结束时间
                    </span>
                    <input
                      aria-label={`第 ${index + 1} 节结束时间`}
                      type="time"
                      value={period.end}
                      onChange={(event) =>
                        updateSettings((settings) => ({
                          ...settings,
                          periods: settings.periods.map((item) =>
                            item.id === period.id
                              ? { ...item, end: event.target.value }
                              : item,
                          ),
                        }))
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
            <div className="period-settings__actions">
              <button type="button" className="text-button" onClick={addPeriod}>
                <Plus size={15} /> 添加一节
              </button>
              <button
                type="button"
                className="text-button text-button--danger"
                onClick={removeLastPeriod}
                disabled={data.settings.periods.length <= 1}
              >
                <Trash2 size={14} /> 删除最后一节
              </button>
              <span>最多 16 节 · 默认时间参考图片中的课表</span>
            </div>
            {invalidPeriod && (
              <div className="form-error period-time-error" role="alert">
                <AlertTriangle size={15} />第{" "}
                {data.settings.periods.indexOf(invalidPeriod) + 1}{" "}
                节的结束时间需要晚于开始时间，修正后才能导出。
              </div>
            )}
          </div>
        </section>
      )}

      <div className="workspace-grid">
        <section className="timetable-panel" aria-labelledby="timetable-title">
          <div className="panel-heading">
            <div>
              <div className="panel-heading__title-row">
                <h2 id="timetable-title">
                  {data.settings.title || "我的课表"}
                </h2>
                <span className="semester-pill">
                  {data.settings.semester || `${data.settings.totalWeeks} 周`}
                </span>
              </div>
              <p>
                {data.courses.length
                  ? `${data.courses.length} 门课程 · ${sessionCount} 个上课安排`
                  : "还没有课程，先添加一门试试。"}
              </p>
            </div>
            <button
              className="button button--add"
              type="button"
              onClick={startNewCourse}
            >
              <Plus size={17} />
              <span>添加课程</span>
            </button>
          </div>

          {conflictCount > 0 && (
            <div className="conflict-banner" role="status">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>
                {conflictCount} 个上课安排与同周课程时间重叠，请检查周次或节次。
              </span>
            </div>
          )}

          <div className="board-scroll">
            <TimetableBoard
              courses={data.courses}
              settings={data.settings}
              selectedCourseId={selectedCourseId}
              onSelectCourse={selectCourse}
            />
          </div>

          {!data.courses.length && (
            <div className="empty-hint">
              <div className="empty-hint__icon">
                <BookOpenCheck size={20} aria-hidden="true" />
              </div>
              <div>
                <strong>从每周固定的课程开始</strong>
                <span>选择星期、节次和周次后，课程会出现在上方课表里。</span>
              </div>
              <button
                type="button"
                className="text-button"
                onClick={startNewCourse}
              >
                添加第一门课 <ChevronDown size={15} className="rotate-left" />
              </button>
            </div>
          )}
        </section>

        <aside className="editor-panel" aria-labelledby="editor-title">
          {draft ? (
            <form className="course-form" onSubmit={saveCourse}>
              <div className="editor-heading">
                <div className="editor-heading__icon">
                  <CalendarDays size={18} aria-hidden="true" />
                </div>
                <div>
                  <h2 id="editor-title">
                    {isEditingExisting ? "编辑课程" : "添加课程"}
                  </h2>
                  <p>课程内容和上课安排</p>
                </div>
                <button
                  className="icon-button editor-close"
                  type="button"
                  aria-label="关闭编辑"
                  onClick={() => {
                    setDraft(null);
                    setDraftDirty(false);
                    setWeekError("");
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <label className="field">
                <span>
                  课程名称 <b>*</b>
                </span>
                <input
                  autoFocus
                  value={draft.name}
                  maxLength={40}
                  onChange={(event) => changeDraft("name", event.target.value)}
                  placeholder="例如：大学英语"
                  required
                />
              </label>
              <div className="form-row">
                <label className="field">
                  <span>
                    上课地点 <small>可选</small>
                  </span>
                  <input
                    value={draft.location}
                    maxLength={24}
                    onChange={(event) =>
                      changeDraft("location", event.target.value)
                    }
                    placeholder="例如：A3-204"
                  />
                </label>
                <label className="field">
                  <span>
                    授课教师 <small>可选</small>
                  </span>
                  <input
                    value={draft.teacher}
                    maxLength={20}
                    onChange={(event) =>
                      changeDraft("teacher", event.target.value)
                    }
                    placeholder="例如：王老师"
                  />
                </label>
              </div>

              <fieldset className="color-fieldset">
                <legend>课程颜色</legend>
                <div className="color-options">
                  {COURSE_COLORS.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      className={`color-swatch${draft.color === color.value ? " is-active" : ""}`}
                      style={{ "--swatch-color": color.value } as CSSProperties}
                      aria-label={color.name}
                      aria-pressed={draft.color === color.value}
                      onClick={() => changeDraft("color", color.value)}
                    >
                      {draft.color === color.value && (
                        <Check size={15} aria-hidden="true" />
                      )}
                    </button>
                  ))}
                  <span className="color-caption">
                    {COURSE_COLORS.find((color) => color.value === draft.color)
                      ?.name ?? "自定义色"}
                  </span>
                </div>
              </fieldset>

              <div className="meeting-section-heading">
                <div>
                  <h3>上课安排</h3>
                  <p>同一门课可以添加多个时段</p>
                </div>
                <button
                  className="button button--small"
                  type="button"
                  onClick={addMeeting}
                >
                  <Plus size={14} /> 加时段
                </button>
              </div>

              <div className="meeting-list">
                {draft.meetings.map((meeting, index) => {
                  const startTime =
                    data.settings.periods[meeting.startPeriod - 1]?.start;
                  const endTime =
                    data.settings.periods[meeting.endPeriod - 1]?.end;
                  return (
                    <section className="meeting-card" key={meeting.id}>
                      <div className="meeting-card__top">
                        <span>安排 {String(index + 1).padStart(2, "0")}</span>
                        {draft.meetings.length > 1 && (
                          <button
                            className="icon-button icon-button--small"
                            type="button"
                            aria-label={`删除第 ${index + 1} 条安排`}
                            onClick={() => removeMeeting(index)}
                          >
                            <X size={15} />
                          </button>
                        )}
                      </div>
                      <label className="field">
                        <span>星期</span>
                        <select
                          value={meeting.day}
                          onChange={(event) =>
                            changeMeeting(
                              index,
                              "day",
                              Number(event.target.value),
                            )
                          }
                        >
                          {DAY_NAMES.map((day, dayIndex) => (
                            <option value={dayIndex + 1} key={day}>
                              {day}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="form-row form-row--compact">
                        <label className="field">
                          <span>开始节次</span>
                          <select
                            value={meeting.startPeriod}
                            onChange={(event) =>
                              changeMeeting(
                                index,
                                "startPeriod",
                                Number(event.target.value),
                              )
                            }
                          >
                            {data.settings.periods.map(
                              (period, periodIndex) => (
                                <option key={period.id} value={periodIndex + 1}>
                                  {periodIndex + 1} · {period.start}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                        <label className="field">
                          <span>结束节次</span>
                          <select
                            value={meeting.endPeriod}
                            onChange={(event) =>
                              changeMeeting(
                                index,
                                "endPeriod",
                                Number(event.target.value),
                              )
                            }
                          >
                            {data.settings.periods.map(
                              (period, periodIndex) => (
                                <option key={period.id} value={periodIndex + 1}>
                                  {periodIndex + 1} · {period.end}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                      </div>
                      {startTime && endTime && (
                        <div className="meeting-time">
                          <Clock3 size={13} aria-hidden="true" />
                          {startTime}–{endTime}
                        </div>
                      )}
                      <label className="field field--weeks">
                        <span>上课周次</span>
                        <input
                          value={meeting.weeksText}
                          onChange={(event) =>
                            changeMeeting(
                              index,
                              "weeksText",
                              event.target.value,
                            )
                          }
                          placeholder="每周、单周、双周或 1-8,11-16"
                        />
                        <small>
                          可以输入「每周」「单周」「双周」或周次范围
                        </small>
                      </label>
                    </section>
                  );
                })}
              </div>

              {weekError && (
                <div className="form-error" role="alert">
                  <AlertTriangle size={15} />
                  {weekError}
                </div>
              )}
              <div className="form-actions">
                {isEditingExisting && (
                  <button
                    className="icon-button delete-course"
                    type="button"
                    aria-label="删除课程"
                    onClick={deleteCourse}
                  >
                    <Trash2 size={17} />
                  </button>
                )}
                <button className="button button--save" type="submit">
                  <Check size={16} />
                  {isEditingExisting ? "保存修改" : "添加到课表"}
                </button>
              </div>
              <p className="form-footnote">
                <CircleHelp size={13} aria-hidden="true" />{" "}
                课程时间会显示在导出的图片里。
              </p>
            </form>
          ) : (
            <div className="editor-empty">
              <div className="editor-empty__art">
                <CalendarDays size={24} aria-hidden="true" />
                <span />
              </div>
              <h2 id="editor-title">把课程放进课表</h2>
              <p>
                点击上方的课程卡片可以编辑，也可以新建一门课并设置上课周次。
              </p>
              <button
                className="button button--primary editor-empty__button"
                type="button"
                onClick={startNewCourse}
              >
                <Plus size={16} />
                添加课程
              </button>
              <div className="editor-tip">
                <span className="editor-tip__icon">
                  <Clock3 size={15} />
                </span>
                <span>
                  不同周次的课程可以安排在相同时间，系统只提示同周冲突。
                </span>
              </div>
              <div className="editor-stats">
                <div>
                  <strong>{data.courses.length}</strong>
                  <span>门课程</span>
                </div>
                <i />
                <div>
                  <strong>{sessionCount}</strong>
                  <span>个时段</span>
                </div>
                <i />
                <div>
                  <strong>{data.settings.totalWeeks}</strong>
                  <span>周学期</span>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      <footer className="page-footer">
        <span>课表只保存在这个浏览器里。</span>
        <button type="button" className="text-button" onClick={exportBackup}>
          <ArrowDownToLine size={14} />
          下载 JSON 备份
        </button>
      </footer>

      <div className="toast-region" aria-live="polite" aria-atomic="true">
        {notice && (
          <div className="notice-toast">
            <span>{notice}</span>
            <button
              type="button"
              aria-label="关闭提示"
              onClick={() => setNotice("")}
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>

      <div className="export-render-root" aria-hidden="true">
        <div ref={exportRef} className="export-render-node">
          <TimetableBoard
            courses={data.courses}
            settings={data.settings}
            exportMode
          />
        </div>
      </div>

      {previewUrl && (
        <div
          className="preview-backdrop"
          role="presentation"
          tabIndex={-1}
          onKeyDown={(event) => {
            if (event.key === "Escape") setPreviewUrl(null);
          }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewUrl(null);
          }}
        >
          <section
            className="preview-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-title"
          >
            <div className="preview-dialog__header">
              <div>
                <span className="preview-kicker">PNG 预览</span>
                <h2 id="preview-title">看看导出效果</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                aria-label="关闭预览"
                autoFocus
                onClick={() => setPreviewUrl(null)}
              >
                <X size={19} />
              </button>
            </div>
            <div className="preview-dialog__image-wrap">
              <img src={previewUrl} alt={`${data.settings.title}课表预览`} />
            </div>
            <div className="preview-dialog__footer">
              <p>长按图片可保存到手机相册</p>
              <button
                type="button"
                className="button button--primary"
                onClick={downloadPng}
              >
                <Download size={16} />
                下载 PNG
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
