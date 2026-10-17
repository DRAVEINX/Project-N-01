/* Mivoryntra splash screen and first-run intro. No network calls or external assets. */
(() => {
  "use strict";
  const copy = {
    nl: {
      tagline:"Jouw dag. Jouw tempo. Jouw ruimte.",
      introTitle:"Fijn dat je er bent.",
      introText:"Mivoryntra helpt je om je dag op jouw manier vorm te geven — rustig, overzichtelijk en stap voor stap.",
      routinesTitle:"Routines", routinesText:"Maak kleine stappen en vaste gewoontes overzichtelijk.",
      calmTitle:"Rustmomenten", calmText:"Neem ademruimte wanneer je dat nodig hebt.",
      wordsTitle:"Jouw woorden", wordsText:"Gebruik eenvoudige zinnen, spraak en tekeningen om jezelf te uiten.",
      start:"Begin mijn dag", skip:"Intro overslaan", loading:"Jouw ruimte wordt klaargemaakt…", replay:"Introductie opnieuw bekijken",
      privacy:"Persoonlijke gegevens blijven op dit apparaat en worden alleen opgeslagen in je versleutelde kluis."
    },
    en: {
      tagline:"Your day. Your pace. Your space.",
      introTitle:"It is good to have you here.",
      introText:"Mivoryntra helps you shape your day in your own way — calmly, clearly and one step at a time.",
      routinesTitle:"Routines", routinesText:"Make small steps and everyday habits easier to manage.",
      calmTitle:"Calm moments", calmText:"Take a breather whenever you need one.",
      wordsTitle:"Your words", wordsText:"Use simple phrases, speech and drawings to express yourself.",
      start:"Start my day", skip:"Skip intro", loading:"Preparing your space…", replay:"View the introduction again",
      privacy:"Personal information stays on this device and is only saved in your encrypted vault."
    }
  };
  const seenKey = "mivoryntra-intro-seen-v1";
  const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let language = window.ProjectNApp ? window.ProjectNApp.getLanguage() : "nl";
  let autoCloseTimer = null;
  let returnFocus = null;
  const screen = document.createElement("div");
  screen.id = "launch-screen";
  screen.className = "launch-screen";
  screen.hidden = true;
  screen.setAttribute("role", "dialog");
  screen.setAttribute("aria-modal", "true");
  screen.setAttribute("aria-labelledby", "launch-title");
  screen.innerHTML = [
    '<div class="launch-backdrop" aria-hidden="true"><span class="launch-glow launch-glow-one"></span><span class="launch-glow launch-glow-two"></span><span class="launch-orbit launch-orbit-one"></span><span class="launch-orbit launch-orbit-two"></span></div>',
    '<div class="launch-card">',
    '<div class="launch-logo" aria-hidden="true"><span class="launch-logo-core"></span><span class="launch-logo-ring"></span><span class="launch-logo-star">✦</span></div>',
    '<p class="launch-kicker" data-intro-text="loading">Jouw ruimte wordt klaargemaakt…</p>',
    '<h1 id="launch-title">Mivoryntra</h1>',
    '<p class="launch-tagline" data-intro-text="tagline">Jouw dag. Jouw tempo. Jouw ruimte.</p>',
    '<div class="launch-intro" id="launch-intro">',
    '<h2 data-intro-text="introTitle">Fijn dat je er bent.</h2>',
    '<p data-intro-text="introText">Mivoryntra helpt je om je dag op jouw manier vorm te geven — rustig, overzichtelijk en stap voor stap.</p>',
    '<div class="launch-pillars">',
    '<article><span aria-hidden="true">◷</span><h3 data-intro-text="routinesTitle">Routines</h3><p data-intro-text="routinesText">Maak kleine stappen en vaste gewoontes overzichtelijk.</p></article>',
    '<article><span aria-hidden="true">✧</span><h3 data-intro-text="calmTitle">Rustmomenten</h3><p data-intro-text="calmText">Neem ademruimte wanneer je dat nodig hebt.</p></article>',
    '<article><span aria-hidden="true">♡</span><h3 data-intro-text="wordsTitle">Jouw woorden</h3><p data-intro-text="wordsText">Gebruik eenvoudige zinnen, spraak en tekeningen om jezelf te uiten.</p></article>',
    '</div>',
    '<p class="launch-privacy" data-intro-text="privacy">Persoonlijke gegevens blijven op dit apparaat en worden alleen opgeslagen in je versleutelde kluis.</p>',
    '</div>',
    '<div class="launch-actions"><button class="primary-button" id="launch-continue" type="button" data-intro-text="start">Begin mijn dag</button><button class="launch-skip" id="launch-skip" type="button" data-intro-text="skip">Intro overslaan</button></div>',
    '</div>'
  ].join("");
  document.body.append(screen);
  const shell = document.querySelector(".app-shell");
  const intro = screen.querySelector("#launch-intro");
  const continueButton = screen.querySelector("#launch-continue");
  const skipButton = screen.querySelector("#launch-skip");
  function t(key) { return copy[language][key] || copy.nl[key] || key; }
  function applyLanguage(next) {
    language = next === "en" ? "en" : "nl";
    screen.querySelectorAll("[data-intro-text]").forEach(node => {
      const key = node.dataset.introText;
      if (t(key)) node.textContent = t(key);
    });
  }
  function closeScreen() {
    if (autoCloseTimer !== null) window.clearTimeout(autoCloseTimer);
    autoCloseTimer = null;
    screen.hidden = true;
    screen.classList.remove("launch-screen--brief");
    if (shell) shell.inert = false;
    try { window.localStorage.setItem(seenKey, "yes"); } catch {}
    const main = document.querySelector("#main");
    if (main) main.focus({preventScroll:true});
    else if (returnFocus && typeof returnFocus.focus === "function") returnFocus.focus();
  }
  function showIntro() {
    if (autoCloseTimer !== null) window.clearTimeout(autoCloseTimer);
    autoCloseTimer = null;
    returnFocus = document.activeElement;
    screen.hidden = false;
    screen.classList.remove("launch-screen--brief");
    intro.hidden = false;
    continueButton.textContent = t("start");
    skipButton.hidden = false;
    if (shell) shell.inert = true;
    applyLanguage(language);
    window.requestAnimationFrame(() => continueButton.focus({preventScroll:true}));
  }
  continueButton.addEventListener("click", closeScreen);
  skipButton.addEventListener("click", closeScreen);
  screen.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); closeScreen(); }
  });
  applyLanguage(language);
  let hasSeen = false;
  try { hasSeen = window.localStorage.getItem(seenKey) === "yes"; } catch {}
  returnFocus = document.activeElement;
  screen.hidden = false;
  if (shell) shell.inert = true;
  if (hasSeen) {
    screen.classList.add("launch-screen--brief");
    intro.hidden = true;
    continueButton.textContent = language === "nl" ? "Openen" : "Open app";
    skipButton.hidden = false;
    if (reducedMotion) closeScreen();
    else autoCloseTimer = window.setTimeout(closeScreen, 1450);
  } else {
    intro.hidden = false;
    window.requestAnimationFrame(() => continueButton.focus({preventScroll:true}));
  }
  window.MivoryntraIntro = { showIntro, applyLanguage };
})();