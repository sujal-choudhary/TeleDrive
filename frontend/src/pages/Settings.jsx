import { useState } from 'react'
import { ArrowPathIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { triggerTelegramSync } from '../services/files'

export default function Settings() {
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null)
  const [syncError, setSyncError] = useState(null)

  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    setSyncError(null)
    try {
      const data = await triggerTelegramSync()
      setSyncResult(data)
    } catch (err) {
      setSyncError(err.message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Configure TeleDrive's storage and sync behavior
        </p>
      </div>

      {/* Storage info */}
      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Storage Backend</h2>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
            <span className="text-sm text-gray-600">Storage provider</span>
            <span className="text-sm font-medium text-gray-900">Telegram Bot API</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
            <span className="text-sm text-gray-600">Metadata database</span>
            <span className="text-sm font-medium text-gray-900">SQLite</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
            <span className="text-sm text-gray-600">Architecture</span>
            <span className="text-sm font-medium text-gray-900">
              Telegram = files · SQLite = metadata
            </span>
          </div>
        </div>
      </section>

      {/* Telegram sync */}
      <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Telegram Synchronization</h2>
        <p className="mt-2 text-sm text-gray-600">
          Scan the Telegram storage chat for files that were sent manually.
          New documents will appear in your TeleDrive dashboard.
        </p>

        <div className="mt-4">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync from Telegram'}
          </button>

          {syncResult && (
            <div className="mt-4 flex items-start gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">Sync complete</p>
                <p className="mt-1 text-green-600">
                  {syncResult.synced} file(s) synced, {syncResult.skipped} skipped.
                </p>
              </div>
            </div>
          )}

          {syncError && (
            <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {syncError}
            </div>
          )}
        </div>
      </section>

      {/* About */}
      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">About</h2>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
            <span className="text-sm text-gray-600">Version</span>
            <span className="text-sm font-medium text-gray-900">1.0.0</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
            <span className="text-sm text-gray-600">License</span>
            <span className="text-sm font-medium text-gray-900">MIT</span>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
            <span className="text-sm text-gray-600">Project</span>
            <a
              href="https://github.com/teledrive/teledrive"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Open Source
            </a>
          </div>
        </div>
        <p className="mt-6 text-sm text-gray-500">
          TeleDrive is a personal cloud file manager that uses Telegram as its storage backend.
          No accounts. No authentication. Just your files, stored privately in your own Telegram chat.
        </p>
      </section>
    </div>
  )
}