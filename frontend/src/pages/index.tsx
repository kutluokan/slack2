import { useState } from 'react';
import Head from 'next/head';

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100">
      <Head>
        <title>Slack2</title>
        <meta name="description" content="Slack2 - AI-powered chat application" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className="container mx-auto px-4">
        <div className="flex h-screen">
          {/* Sidebar */}
          <div className="w-64 bg-gray-800 text-white">
            <div className="p-4">
              <h1 className="text-xl font-bold">Slack2</h1>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col">
            {/* Header */}
            <div className="h-16 border-b flex items-center px-6">
              <h2 className="text-lg font-semibold">#general</h2>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Messages will go here */}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t">
              <input
                type="text"
                placeholder="Type a message..."
                className="w-full px-4 py-2 rounded-md border focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}