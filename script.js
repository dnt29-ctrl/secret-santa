const people = ['Jade', 'Carla', 'Tristan', 'Eflamm', 'Samia', 'Meven', 'Camille'];
const couples = { Jade: 'Carla', Carla: 'Jade', Tristan: 'Eflamm', Eflamm: 'Tristan', Samia: 'Meven', Meven: 'Samia' };
const STORAGE_KEY = 'secret-santa-2026-v1';
const params = new URLSearchParams(location.search);
const encryptedGift = params.get('gift');
const drawButton = document.getElementById('drawButton');
const linksPanel = document.getElementById('linksPanel');
const linksList = document.getElementById('linksList');

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

function toBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function fromBase64Url(value) {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
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
  url.search = `?gift=${toBase64Url(payload)}`;
  url.hash = toBase64Url(keyBytes);
  return url.href;
}

function renderLinks(draw) {
  linksList.replaceChildren();
  for (const giver of people) {
    const li = document.createElement('li');
    const label = document.createElement('label');
    label.textContent = giver;
    const input = document.createElement('input');
    input.readOnly = true;
    input.value = draw[giver];
    input.setAttribute('aria-label', `Destinataire de ${giver} — ne pas partager`);
    const button = document.createElement('button');
    button.className = 'copy-one';
    button.type = 'button';
    button.textContent = 'Copier le lien';
    button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(input.dataset.link); button.textContent = 'Copié !'; }
      catch { input.focus(); input.select(); document.execCommand('copy'); button.textContent = 'Copié !'; }
      setTimeout(() => { button.textContent = 'Copier le lien'; }, 1400);
    });
    li.append(label, input, button);
    linksList.append(li);
    createPersonalLink(giver, draw[giver]).then((link) => { input.dataset.link = link; input.value = link; });
  }
  linksPanel.hidden = false;
}

async function reveal() {
  try {
    const keyBytes = fromBase64Url(location.hash.slice(1));
    const payload = fromBase64Url(encryptedGift);
    if (keyBytes.length !== 32 || payload.length < 29) throw new Error('Lien incomplet');
    const key = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['decrypt']);
    const iv = payload.slice(0, 12);
    const ciphertext = payload.slice(12);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    const { giver, receiver } = JSON.parse(new TextDecoder().decode(plaintext));
    if (!people.includes(giver) || !people.includes(receiver) || giver === receiver || couples[giver] === receiver) throw new Error('Tirage invalide');
    document.getElementById('drawSection').hidden = true;
    document.getElementById('revealSection').hidden = false;
    document.getElementById('revealHeading').textContent = `Pour ${giver}`;
    document.getElementById('recipient').textContent = receiver;
  } catch {
    document.getElementById('drawSection').hidden = true;
    const section = document.getElementById('revealSection');
    section.hidden = false;
    section.querySelector('.handwritten').textContent = 'Oh non, le petit mot est illisible !';
    document.getElementById('revealHeading').textContent = 'Lien invalide ou incomplet';
    document.getElementById('recipient').textContent = 'Demande un nouveau lien à la personne qui organise.';
  }
}

async function prepareDraw(force = false) {
  let draw;
  try { draw = !force && JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { draw = null; }
  if (!draw || people.some((person) => !people.includes(draw[person]))) {
    draw = makeDraw();
    if (!draw) { alert('Impossible de faire un tirage avec ces contraintes.'); return; }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draw));
  }
  renderLinks(draw);
}

drawButton.addEventListener('click', async () => {
  if (localStorage.getItem(STORAGE_KEY) && !confirm('Un tirage existe déjà dans ce navigateur. En refaire un rendra les anciens liens inutilisables. Continuer ?')) return;
  drawButton.disabled = true;
  drawButton.textContent = 'Préparation des petits mots…';
  try {
    localStorage.removeItem(STORAGE_KEY);
    await prepareDraw(true);
  } finally {
    drawButton.disabled = false;
    drawButton.textContent = '🎲 Faire le tirage & préparer les liens';
  }
});

document.getElementById('copyAllButton').addEventListener('click', async () => {
  const lines = [...linksList.querySelectorAll('li')].map((li) => `${li.querySelector('label').textContent} : ${li.querySelector('input').dataset.link}`);
  if (lines.some((line) => line.endsWith(': undefined'))) return;
  try {
    await navigator.clipboard.writeText(lines.join('\n'));
    const button = document.getElementById('copyAllButton');
    button.textContent = 'Tout est copié !';
    setTimeout(() => { button.textContent = 'Copier tous les liens'; }, 1500);
  } catch { alert('La copie automatique a échoué. Copie les liens un par un.'); }
});

if (encryptedGift) reveal();
else prepareDraw();
