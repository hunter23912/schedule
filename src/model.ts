export type Period = {
  id: string
  start: string
  end: string
}

export type Meeting = {
  id: string
  day: number
  startPeriod: number
  endPeriod: number
  weeks: number[]
}

export type Course = {
  id: string
  name: string
  teacher: string
  location: string
  color: string
  meetings: Meeting[]
}

export type ScheduleSettings = {
  title: string
  semester: string
  totalWeeks: number
  rowHeight: number
  periods: Period[]
}

export type ScheduleData = {
  version: 1
  settings: ScheduleSettings
  courses: Course[]
}

export const STORAGE_KEY = 'campus-schedule-v1'

export const COURSE_COLORS = [
  { name: '蓝莓', value: '#91b5ef' },
  { name: '蜜桃', value: '#ef9eb7' },
  { name: '薄荷', value: '#75cfc2' },
  { name: '柠檬', value: '#efd24f' },
  { name: '薰衣草', value: '#ae91ed' },
  { name: '珊瑚', value: '#f29b82' },
  { name: '天空', value: '#7dc9eb' },
]

const DEFAULT_PERIODS: Period[] = [
  ['08:00', '08:45'],
  ['08:50', '09:35'],
  ['09:50', '10:35'],
  ['10:40', '11:25'],
  ['11:30', '12:15'],
  ['14:00', '14:45'],
  ['14:50', '15:35'],
  ['15:50', '16:35'],
  ['16:40', '17:25'],
  ['17:30', '18:15'],
].map(([start, end], index) => ({ id: `period-${index + 1}`, start, end }))

export function createDefaultData(): ScheduleData {
  return {
    version: 1,
    settings: {
      title: '我的课表',
      semester: '',
      totalWeeks: 20,
      rowHeight: 82,
      periods: DEFAULT_PERIODS.map((period) => ({ ...period })),
    },
    courses: [],
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseScheduleData(value: unknown): ScheduleData | null {
  if (!isRecord(value) || !isRecord(value.settings) || !Array.isArray(value.courses)) return null
  const settings = value.settings
  if (!Array.isArray(settings.periods)) return null

  const totalWeeks = Number(settings.totalWeeks)
  if (!Number.isInteger(totalWeeks) || totalWeeks < 1 || totalWeeks > 60) return null
  const storedRowHeight = Number(settings.rowHeight)
  const rowHeight = Number.isInteger(storedRowHeight) && storedRowHeight >= 68 && storedRowHeight <= 118 && (storedRowHeight - 68) % 2 === 0
    ? storedRowHeight
    : 82

  const periods = settings.periods.filter((period): period is Record<string, unknown> => isRecord(period))
    .map((period, index) => ({
      id: typeof period.id === 'string' ? period.id : `period-${index + 1}`,
      start: typeof period.start === 'string' ? period.start : '',
      end: typeof period.end === 'string' ? period.end : '',
    }))
  if (periods.length < 1 || periods.length > 16 || periods.some((period) => !isTime(period.start) || !isTime(period.end) || timeToMinutes(period.start) >= timeToMinutes(period.end))) return null

  const courses: Course[] = []
  for (const rawCourse of value.courses) {
    if (!isRecord(rawCourse) || !Array.isArray(rawCourse.meetings)) return null
    const meetings: Meeting[] = []
    for (const rawMeeting of rawCourse.meetings) {
      if (!isRecord(rawMeeting) || !Array.isArray(rawMeeting.weeks)) return null
      const day = Number(rawMeeting.day)
      const startPeriod = Number(rawMeeting.startPeriod)
      const endPeriod = Number(rawMeeting.endPeriod)
      const weeks = rawMeeting.weeks.map(Number).filter((week) => Number.isInteger(week) && week >= 1 && week <= totalWeeks)
      if (!Number.isInteger(day) || day < 1 || day > 7 || !Number.isInteger(startPeriod) || !Number.isInteger(endPeriod) || startPeriod < 1 || endPeriod < startPeriod || endPeriod > periods.length || weeks.length === 0) return null
      meetings.push({
        id: typeof rawMeeting.id === 'string' ? rawMeeting.id : createId(),
        day,
        startPeriod,
        endPeriod,
        weeks: [...new Set(weeks)].sort((a, b) => a - b),
      })
    }
    courses.push({
      id: typeof rawCourse.id === 'string' ? rawCourse.id : createId(),
      name: typeof rawCourse.name === 'string' ? rawCourse.name : '',
      teacher: typeof rawCourse.teacher === 'string' ? rawCourse.teacher : '',
      location: typeof rawCourse.location === 'string' ? rawCourse.location : '',
      color: typeof rawCourse.color === 'string' ? rawCourse.color : COURSE_COLORS[0].value,
      meetings,
    })
  }

  return {
    version: 1,
    settings: {
      title: typeof settings.title === 'string' ? settings.title : '我的课表',
      semester: typeof settings.semester === 'string' ? settings.semester : '',
      totalWeeks,
      rowHeight,
      periods,
    },
    courses,
  }
}

export function loadSchedule(): { data: ScheduleData; failed: boolean } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return { data: createDefaultData(), failed: false }
    const parsed = parseScheduleData(JSON.parse(saved) as unknown)
    return parsed ? { data: parsed, failed: false } : { data: createDefaultData(), failed: true }
  } catch {
    return { data: createDefaultData(), failed: true }
  }
}

export function createId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function isTime(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

export function timeToMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number)
  return hour * 60 + minute
}

export function parseWeeks(text: string, totalWeeks: number): number[] | null {
  const raw = text.trim().replaceAll('，', ',').replaceAll('、', ',').replaceAll('；', ',').replaceAll(';', ',').replaceAll('～', '-').replaceAll('~', '-').replaceAll('—', '-').replaceAll('–', '-')
  if (!raw) return null
  if (['全周', '每周', '全部', 'all'].includes(raw.toLowerCase())) return Array.from({ length: totalWeeks }, (_, index) => index + 1)
  if (raw === '单周') return Array.from({ length: totalWeeks }, (_, index) => index + 1).filter((week) => week % 2 === 1)
  if (raw === '双周') return Array.from({ length: totalWeeks }, (_, index) => index + 1).filter((week) => week % 2 === 0)

  const weeks = new Set<number>()
  for (const token of raw.replaceAll('周', '').split(',').map((part) => part.trim()).filter(Boolean)) {
    const match = token.match(/^(\d+)\s*(?:-\s*(\d+))?$/)
    if (!match) return null
    const start = Number(match[1])
    const end = match[2] ? Number(match[2]) : start
    if (start < 1 || end < start || end > totalWeeks) return null
    for (let week = start; week <= end; week += 1) weeks.add(week)
  }
  return weeks.size ? [...weeks].sort((a, b) => a - b) : null
}

export function formatWeeks(weeks: number[], totalWeeks: number): string {
  const sorted = [...new Set(weeks)].sort((a, b) => a - b)
  if (sorted.length === totalWeeks && sorted.every((week, index) => week === index + 1)) return '每周'
  const odds = Array.from({ length: totalWeeks }, (_, index) => index + 1).filter((week) => week % 2 === 1)
  const evens = Array.from({ length: totalWeeks }, (_, index) => index + 1).filter((week) => week % 2 === 0)
  if (sameNumbers(sorted, odds)) return '单周'
  if (sameNumbers(sorted, evens)) return '双周'

  const ranges: string[] = []
  for (let index = 0; index < sorted.length;) {
    let endIndex = index
    while (endIndex + 1 < sorted.length && sorted[endIndex + 1] === sorted[endIndex] + 1) endIndex += 1
    ranges.push(endIndex === index ? `${sorted[index]}周` : `${sorted[index]}–${sorted[endIndex]}周`)
    index = endIndex + 1
  }
  return ranges.join('、')
}

function sameNumbers(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

export function getMeetingTime(meeting: Meeting, periods: Period[]): string {
  const start = periods[meeting.startPeriod - 1]?.start
  const end = periods[meeting.endPeriod - 1]?.end
  return start && end ? `${start}–${end}` : ''
}

export function getConflictIds(courses: Course[]): Set<string> {
  const meetings = courses.flatMap((course) => course.meetings.map((meeting) => ({ course, meeting })))
  const conflicts = new Set<string>()
  for (let leftIndex = 0; leftIndex < meetings.length; leftIndex += 1) {
    const left = meetings[leftIndex]
    for (let rightIndex = leftIndex + 1; rightIndex < meetings.length; rightIndex += 1) {
      const right = meetings[rightIndex]
      if (left.meeting.day !== right.meeting.day) continue
      const overlapsInTime = left.meeting.startPeriod <= right.meeting.endPeriod && right.meeting.startPeriod <= left.meeting.endPeriod
      if (!overlapsInTime) continue
      const rightWeeks = new Set(right.meeting.weeks)
      if (!left.meeting.weeks.some((week) => rightWeeks.has(week))) continue
      conflicts.add(left.meeting.id)
      conflicts.add(right.meeting.id)
    }
  }
  return conflicts
}

export type PositionedMeeting = {
  course: Course
  meeting: Meeting
  lane: number
  laneCount: number
  conflict: boolean
}

export function getDayMeetings(courses: Course[], day: number, conflicts: Set<string>): PositionedMeeting[] {
  const items = courses.flatMap((course) => course.meetings
    .filter((meeting) => meeting.day === day)
    .map((meeting) => ({ course, meeting })))
    .sort((a, b) => a.meeting.startPeriod - b.meeting.startPeriod || a.meeting.endPeriod - b.meeting.endPeriod)

  const clusters: typeof items[] = []
  let cluster: typeof items = []
  let clusterEnd = 0
  for (const item of items) {
    if (cluster.length && item.meeting.startPeriod > clusterEnd) {
      clusters.push(cluster)
      cluster = []
      clusterEnd = 0
    }
    cluster.push(item)
    clusterEnd = Math.max(clusterEnd, item.meeting.endPeriod)
  }
  if (cluster.length) clusters.push(cluster)

  return clusters.flatMap((group) => {
    const laneEnds: number[] = []
    const positioned = group.map((item) => {
      let lane = laneEnds.findIndex((end) => end < item.meeting.startPeriod)
      if (lane === -1) lane = laneEnds.length
      laneEnds[lane] = item.meeting.endPeriod
      return { ...item, lane }
    })
    return positioned.map(({ course, meeting, lane }) => ({
      course,
      meeting,
      lane,
      laneCount: laneEnds.length,
      conflict: conflicts.has(meeting.id),
    }))
  })
}
