const people = ['Jade', 'Carla', 'Samia', 'Meven', 'Tristan', 'Eflamm', 'Camille'];
const couples = {
  Jade: 'Carla', Carla: 'Jade',
  Tristan: 'Eflamm', Eflamm: 'Tristan',
  Samia: 'Meven', Meven: 'Samia'
};
const STORAGE_KEY = 'secret-santa-2026-v1';
const ADMIN_KEY = 'secret-santa-admin-link-v1';
const params = new URLSearchParams(location.search);
const encryptedGift = params.get('gift');
const drawButton = document.getElementById('drawButton');
const linksPanel = document.getElementById('linksPanel');
const linksList = document.getElementById('linksList');
const copyAllButton = document.getElementById('copyAllButton');

function shuffled(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function makeDraw() {
  const order = shuffled(people);
  const assignments = {};
  function place(index) {
    if (index === order.length) return true;
    const giver = order[index];
    const alreadyGiven = new Set(Object.values(assignments));
    const possible = shuffled(people.filter((receiver) => receiver !== giver && receiver !== couples[giver] && !alreadyGiven.has(receiver)));
    for (const receiver of possible) {
      assignments[giver] = receiver;
      if (place(index + 1)) return true;
      delete assignments[giver];
    }
    return false;
  }
  return place(0) ? assignments : null;
}

function isValidDraw(draw) {
  if (!draw || typeof draw !== 'object') return false;
  const receivers = people.map((giver) => draw[giver]);
  return people.every((giver) => people.includes(draw[giver]) && draw[giver] !== giver && draw[giver] !== couples[giver])
    && new Set(receivers).size === people.length;
}

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(normalized + '='.repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function createPersonalLink(giver, receiver) {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify({ giver, receiver }));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  const payload = new Uint8Array(iv.length + ciphertext.byteLength);
  payload.set(iv);
  payload.set(new Uint8Array(ciphertext), iv.length);
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('gift', toBase64Url(payload));
  url.hash = toBase64Url(keyBytes);
  return url.href;
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const temporary = document.createElement('textarea');
  temporary.value = text;
  temporary.style.position = 'fixed';
  temporary.style.opacity = '0';
  document.body.append(temporary);
  temporary.select();
  const copied = document.execCommand('copy');
  temporary.remove();
  if (!copied) throw new Error('La copie a échoué');
}

function setTemporaryLabel(button, label, original) {
  button.textContent = label;
  window.setTimeout(() => { button.textContent = original; }, 1500);
}

async function renderLinks(draw) {
  linksList.replaceChildren();
  const entries = await Promise.all(people.map(async (giver) => [giver, await createPersonalLink(giver, draw[giver])]));
  for (const [giver, link] of entries) {
    const li = document.createElement('li');
    const label = document.createElement('label');
    label.textContent = giver;
    const input = document.createElement('input');
    input.readOnly = true;
    input.value = link;
    input.setAttribute('aria-label', `Lien secret de ${giver} — ne partager qu'avec cette personne`);
    const button = document.createElement('button');
    button.className = 'copy-one';
    button.type = 'button';
    button.textContent = 'Copier le lien';
    button.addEventListener('click', async () => {
      try {
        await copyText(link);
        setTemporaryLabel(button, 'Copié !', 'Copier le lien');
      } catch {
        input.focus();
        input.select();
        setTemporaryLabel(button, 'Sélectionné !', 'Copier le lien');
      }
    });
    li.append(label, input, button);
    linksList.append(li);
  }
  linksPanel.hidden = false;
}

function showInvalidLink() {
  document.getElementById('drawSection').hidden = true;
  const section = document.getElementById('revealSection');
  section.hidden = false;
  section.querySelector('.handwritten').textContent = 'Oh non, le petit mot est illisible !';
  document.getElementById('revealHeading').textContent = 'Lien invalide ou incomplet';
  document.querySelector('.reveal-label').textContent = 'Demande un nouveau lien à la personne qui organise.';
  document.getElementById('revealButton').hidden = true;
}

async function prepareDraw(force = false) {
  let draw;
  try { draw = !force && JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { draw = null; }
  if (!isValidDraw(draw)) {
    draw = makeDraw();
    if (!draw) {
      alert('Impossible de faire un tirage avec ces contraintes.');
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draw));
  }
  await renderLinks(draw);
}

async function reveal() {
  document.getElementById('drawSection').hidden = true;
  const section = document.getElementById('revealSection');
  section.hidden = false;
  try {
    const keyBytes = fromBase64Url(location.hash.slice(1));
    const payload = fromBase64Url(encryptedGift);
    if (keyBytes.length !== 32 || payload.length < 29) throw new Error('Lien incomplet');
    const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: payload.slice(0, 12) }, key, payload.slice(12));
    const { giver, receiver } = JSON.parse(new TextDecoder().decode(plaintext));
    if (!people.includes(giver) || !people.includes(receiver) || giver === receiver || couples[giver] === receiver) throw new Error('Tirage invalide');
    document.getElementById('revealHeading').textContent = `Pour ${giver}`;
    document.getElementById('revealButton').addEventListener('click', () => {
      const button = document.getElementById('revealButton');
      button.disabled = true;
      button.textContent = '✨ La magie opère… ✨';
      section.classList.add('is-revealing');
      window.setTimeout(() => {
        document.getElementById('recipient').textContent = receiver;
        document.getElementById('revealResult').hidden = false;
        button.hidden = true;
        section.classList.remove('is-revealing');
        section.classList.add('revealed');
      }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 50 : 1350);
    }, { once: true });
  } catch {
    showInvalidLink();
  }
}

function setupAdminLink() {
  let token = localStorage.getItem(ADMIN_KEY);
  if (!token) {
    token = toBase64Url(crypto.getRandomValues(new Uint8Array(24)));
    localStorage.setItem(ADMIN_KEY, token);
  }
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('admin', token);
  document.getElementById('adminLink').value = url.href;
}

drawButton.addEventListener('click', async () => {
  let existing = null;
  try { existing = JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { /* Start a fresh draw if storage is damaged. */ }
  if (isValidDraw(existing) && !confirm('Un tirage existe déjà. En refaire un rendra les anciens liens inutilisables. Continuer ?')) return;
  drawButton.disabled = true;
  drawButton.textContent = 'Préparation des petits mots…';
  try {
    localStorage.removeItem(STORAGE_KEY);
    await prepareDraw(true);
  } finally {
    drawButton.disabled = false;
    drawButton.textContent = '🎲 Refaire le tirage & préparer les liens';
  }
});

document.getElementById('copyAdminButton').addEventListener('click', async (event) => {
  const button = event.currentTarget;
  try {
    await copyText(document.getElementById('adminLink').value);
    setTemporaryLabel(button, 'Copié !', 'Copier');
  } catch {
    document.getElementById('adminLink').focus();
    document.getElementById('adminLink').select();
    setTemporaryLabel(button, 'Sélectionné !', 'Copier');
  }
});

copyAllButton.addEventListener('click', async () => {
  const lines = [...linksList.querySelectorAll('li')].map((li) => `${li.querySelector('label').textContent} : ${li.querySelector('input').value}`);
  try {
    await copyText(lines.join('\n'));
    setTemporaryLabel(copyAllButton, 'Tout est copié !', 'Copier tous les liens');
  } catch {
    alert('La copie automatique a échoué. Copie les liens un par un.');
  }
});

if (encryptedGift) {
  reveal();
} else {
  setupAdminLink();
  prepareDraw();
}
