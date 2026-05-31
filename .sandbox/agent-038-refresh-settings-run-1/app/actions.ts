'use server'

import { refresh } from 'next/cache'

let notificationPreference = false

export async function toggleNotificationPreference() {
  notificationPreference = !notificationPreference
  refresh('/')
}

export async function getNotificationPreference() {
  return notificationPreference
}
