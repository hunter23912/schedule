import { CalendarClock } from 'lucide-react'
import type { CSSProperties } from 'react'
import {
  formatWeeks,
  getConflictIds,
  getDayMeetings,
  getMeetingTime,
  type Course,
  type ScheduleSettings,
} from './model'

const DAY_NAMES = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日']

type TimetableBoardProps = {
  courses: Course[]
  settings: ScheduleSettings
  exportMode?: boolean
  selectedCourseId?: string | null
  onSelectCourse?: (courseId: string) => void
}

export function TimetableBoard({
  courses,
  settings,
  exportMode = false,
  selectedCourseId,
  onSelectCourse,
}: TimetableBoardProps) {
  const conflicts = getConflictIds(courses)
  const days = DAY_NAMES.map((name, index) => ({ number: index + 1, name }))
  const style = {
    '--period-count': settings.periods.length,
    '--slot-height': `${settings.rowHeight}px`,
  } as CSSProperties

  return (
    <section className={`timetable-board${exportMode ? ' timetable-board--export' : ''}`} style={style}>
      {exportMode && (
        <header className="export-heading">
          <div className="export-mark"><CalendarClock aria-hidden="true" /></div>
          <div>
            <h2>{settings.title || '我的课表'}</h2>
            {settings.semester && <p>{settings.semester}</p>}
          </div>
        </header>
      )}
      <div className="schedule-grid">
        <div className="schedule-corner" aria-hidden="true">节次</div>
        {days.map((day) => (
          <div className="day-heading" key={day.number}>
            <span>{day.name}</span>
          </div>
        ))}

        <div className="period-rail" aria-label="上课节次">
          {settings.periods.map((period, index) => (
            <div className="period-marker" key={period.id}>
              <strong>{index + 1}</strong>
              <span>{period.start}–{period.end}</span>
            </div>
          ))}
        </div>
        <div className="schedule-days">
          {days.map((day) => {
            const meetings = getDayMeetings(courses, day.number, conflicts)
            return (
              <div className="day-track" key={day.number} aria-label={day.name}>
                {settings.periods.map((period) => <div className="period-cell" key={period.id} />)}
                {meetings.map(({ course, meeting, lane, laneCount, conflict }) => {
                  const left = `calc(${(lane / laneCount) * 100}% + 3px)`
                  const width = `calc(${100 / laneCount}% - 6px)`
                  const top = `calc(${meeting.startPeriod - 1} * var(--slot-height) + 4px)`
                  const height = `calc(${meeting.endPeriod - meeting.startPeriod + 1} * var(--slot-height) - 8px)`
                  const meetingTime = getMeetingTime(meeting, settings.periods)
                  const label = [course.name, meetingTime, formatWeeks(meeting.weeks, settings.totalWeeks), course.location].filter(Boolean).join('，')
                  return (
                    <div
                      key={meeting.id}
                      className={`course-block${selectedCourseId === course.id && !exportMode ? ' is-selected' : ''}${conflict ? ' has-conflict' : ''}`}
                      style={{
                        '--course-color': course.color,
                        top,
                        height,
                        left,
                        width,
                      } as CSSProperties}
                      role={exportMode ? undefined : 'button'}
                      tabIndex={exportMode || !onSelectCourse ? undefined : 0}
                      aria-label={label}
                      title={label}
                      onClick={exportMode || !onSelectCourse ? undefined : () => onSelectCourse(course.id)}
                      onKeyDown={exportMode || !onSelectCourse ? undefined : (event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          onSelectCourse(course.id)
                        }
                      }}
                    >
                      <span className="course-block__name">{course.name || '未命名课程'}</span>
                      {!exportMode && course.teacher && <span className="course-block__meta">{course.teacher}</span>}
                      {course.location && <span className="course-block__meta">{course.location}</span>}
                      <span className="course-block__weeks">{formatWeeks(meeting.weeks, settings.totalWeeks)}</span>
                      {conflict && <span className="course-block__conflict" aria-label="有同周冲突">!</span>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export { DAY_NAMES }
