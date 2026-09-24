# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React, TypeScript, and Vite, selected for a client-side personal timetable editor.

## Users

One university student creating and viewing their own semester timetable.

## Product Purpose

Let a student enter a semester's classes and export a readable timetable image for a phone photo library. Success means the student can edit one semester timetable, reopen it later in the same browser, and save a PNG that clearly shows class times and applicable weeks.

## Capabilities and Constraints

- No account or server is needed for the first version; save locally in the browser and support JSON backup and restore.
- Support a configurable period schedule, weekdays, courses spanning multiple periods, and course meetings that repeat on selected weeks, odd weeks, or even weeks.
- Export one semester overview without current date, current weekday, or current-week indicators. Include applicable weeks and class times on each course block.
- Display Monday through Sunday and default to a 20-week semester; let the user change these settings.
- Allow different-week classes to share a time slot and warn when actual same-week conflicts occur.

## Brand Commitments

Use the supplied `效果图.PNG` as the visual reference: a soft blue background, seven-day timetable, and distinct pastel course blocks. Preserve the lightweight phone timetable character while improving text legibility.

## Evidence on Hand

- `效果图.PNG` is the user's visual reference.
- `提示词.md` is empty and contains no product requirements.
- No existing application code or backend is present.

## Product Principles

- Keep entering a class quick and understandable.
- Make the exported image easy to read on a phone.
- Preserve timetable data across browser sessions and make it portable through backup files.
