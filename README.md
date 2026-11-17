# RTE Notes

A simple personal notes app that runs on your computer. Write and format your notes, and they're saved automatically to a file on your hard drive. No cloud, no accounts needed.

## What it does

- Create, edit, and delete rich-text documents
- Format text — bold, italic, headings, lists, tables, and more
- Auto-saves while you type
- Pin important notes to the top
- Search notes by title
- Dark mode

## Stack

- **Frontend** — Angular 21
- **Backend** — Node.js + Express
- **Editor** — Zoho RTE 2.0.16
- **Storage** — a local `documents.json` file

## Setup

**1. Start the backend**

```bash
npm install express cors body-parser
node server.js
```

Runs at `http://localhost:3000`

**2. Start the frontend**

```bash
npm install
ng serve
```

Open `http://localhost:4200` in your browser.

## How it works

The Angular frontend talks to the Express backend over a REST API. When you save a note, Express writes it to `documents.json` on your disk. That's it — no database, no cloud.

During development, two servers run: Angular on port 4200, Express on port 3000.

## API

| Method | Endpoint | What it does |
|---|---|---|
| GET | `/api/document/list` | Get all documents |
| POST | `/api/document/store` | Save or update a document |
| PATCH | `/api/document/pin/:id` | Toggle pin |
| DELETE | `/api/document/delete/:id` | Delete a document |

## Notes

- Documents left with the title "Untitled" are automatically renamed to `Untitled 1`, `Untitled 2`, etc.
- Auto-save fires 3 seconds after you stop typing.
- Dark mode resets on page refresh (not yet persisted).
- The editor loads from Zoho's CDN, so an internet connection is needed for editing.
