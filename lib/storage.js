'use strict';

const fs = require('fs');
const path = require('path');

const IDEAS_FILE = path.join(process.cwd(), 'ideas.json');
const BLOB_PATHNAME = 'ideas/ideas.json';

async function readIdeas() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return readFromBlob();
  }
  return readFromFile();
}

async function writeIdeas(ideas) {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return writeToBlob(ideas);
  }
  if (process.env.VERCEL) {
    throw new Error(
      'BLOB_READ_WRITE_TOKEN is required on Vercel. Add a Blob store in your project dashboard and re-deploy. See README for instructions.'
    );
  }
  return writeToFile(ideas);
}

function readFromFile() {
  try {
    const data = fs.readFileSync(IDEAS_FILE, 'utf8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeToFile(ideas) {
  fs.writeFileSync(IDEAS_FILE, JSON.stringify(ideas, null, 2), 'utf8');
}

async function readFromBlob() {
  const { list } = require('@vercel/blob');
  try {
    const { blobs } = await list({ prefix: BLOB_PATHNAME });
    if (blobs.length === 0) return [];
    const res = await fetch(blobs[0].url);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error('Blob read error:', err.message);
    return [];
  }
}

async function writeToBlob(ideas) {
  const { put } = require('@vercel/blob');
  await put(BLOB_PATHNAME, JSON.stringify(ideas, null, 2), {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
    allowOverwrite: true
  });
}

module.exports = { readIdeas, writeIdeas };
