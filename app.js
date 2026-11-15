(() => {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const app = document.querySelector("#preflight-app");
  const statusPill = document.querySelector("#status-pill");
  const timelineState = document.querySelector("#timeline-state");
  const playhead = document.querySelector("#timeline-playhead");
  const subtitlePosition = document.querySelector("#subtitle-position");
  const frameRate = document.querySelector("#frame-rate");
  const fpsCaption = document.querySelector("#fps-caption");
  const idleState = document.querySelector("#state-idle");
  const issuesState = document.querySelector("#state-issues");
  const passState = document.querySelector("#state-pass");
  const issueList = document.querySelector("#issue-list");
  const issueCount = document.querySelector("#issue-count");
  const runCheckButton = document.querySelector("#run-check");
  const fixAllButton = document.querySelector("#fix-all");
  const resetCheckButton = document.querySelector("#reset-check");
  const emitReceiptButton = document.querySelector("#emit-receipt");
  const passTotal = document.querySelector("#pass-total");

  const receiptDialog = document.querySelector("#receipt-dialog");
  const receiptDate = document.querySelector("#receipt-date");
  const receiptCode = document.querySelector("#receipt-code");
  const receiptCorrections = document.querySelector("#receipt-corrections");
  const closeReceiptButton = document.querySelector("#close-receipt");
  const downloadReceiptButton = document.querySelector("#download-receipt");
  const copyReceiptButton = document.querySelector("#copy-receipt");
  const copyStatus = document.querySelector("#copy-status");

  const noteDialog = document.querySelector("#note-dialog");
  const openNoteButton = document.querySelector("[data-open-note]");
  const closeNoteButton = document.querySelector("#close-note");
  const closeNoteAction = document.querySelector("#close-note-action");

  const quoteData = {
    price: {
      counter: "01 / 04",
      rating: "1★ · 2026-11-06",
      fr: "« Je suis dégoûtée, j’ai fait une mise à jour et maintenant pour enregistrer une vidéo il faut payer. Enlevez ce système tout de suite !!!! »",
      zh: "更新之后，连保存视频也要付费了。请马上取消这个机制。",
      id: "Avis 14758878020",
      reading: "不是“不愿意付费”，而是基础动作的边界在变化。用户无法在开始编辑前判断：最后导出时会不会被拦。",
      href: "https://apps.apple.com/fr/app/capcut-%C3%A9diteur-vid%C3%A9o-photo/id1500855883"
    },
    export: {
      counter: "02 / 04",
      rating: "1★ · 2026-10-14",
      fr: "« Le logiciel bug à répétition, il n’est pas capable d’exporter les vidéos en 60fps correctement enfin, je le trouve très mauvais pour le prix… »",
      zh: "软件反复出 bug，连 60fps 视频都不能正确导出；以这个价格来说太差了。",
      id: "Avis 14667472205",
      reading: "交付要求不是抽象的“高质量”。它具体到 60fps、能否打开、能否保存。任何一项失败，前面的剪辑价值都归零。",
      href: "https://apps.apple.com/fr/app/capcut-%C3%A9diteur-vid%C3%A9o-photo/id1500855883"
    },
    reliability: {
      counter: "03 / 04",
      rating: "1★ · 2026-09-18",
      fr: "« Comment être aussi bien et aussi nul à la fois ? Le logiciel est super, intuitif, bien pensé… mais absolument pas fiable. Des projets impossible à ouvrir après quelques semaines, les fonctionnalités que ne fonctionne pas, problèmes d’exports. »",
      zh: "怎么能同时这么好又这么糟？软件很棒、直觉、有想法，但完全不可靠：几周后项目打不开，功能失效，导出出问题。",
      id: "Avis 14564254519",
      reading: "用户并非否定创作体验。真正破坏信任的是：项目做了，却在最后一步变得不可控。好的产品判断要能同时容纳这两面。",
      href: "https://apps.apple.com/fr/app/capcut-%C3%A9diteur-vid%C3%A9o-photo/id1500855883"
    },
    positive: {
      counter: "04 / 04",
      rating: "5★ · 2026-11-05",
      fr: "« L’application est vraiment géniale !! J’ai fait de super montage avec, mais au fil du temps, tout devient pro et c’était un peu énervant mais sinon c’est super !! Je recommande 🥹 »",
      zh: "应用真的很棒，我做了很好的剪辑；但时间久了，什么都在变成 Pro，有点烦，除此之外真的很好，我推荐。",
      id: "Avis 14756465783",
      reading: "这条 5 星反例限制了结论：不能把低均值解释成“产品差”。创作体验仍有价值，摩擦集中发生在边界和交付。",
      href: "https://apps.apple.com/fr/app/capcut-%C3%A9diteur-vid%C3%A9o-photo/id1500855883"
    }
  };

  const state = {
    position: "low",
    fps: 30,
    hasRun: false,
    foundIssues: new Set(),
    correctedIssues: new Set(),
    scanTimer: null,
    activeStage: "idle",
    generatedAt: null
  };

  const issueDefinitions = {
    subtitle: {
      id: "subtitle",
      number: "01",
      title: "Sous-titres dans la zone d’interface",
      detail: "La ligne empiète sur les 18 % inférieurs réservés à l’interface. Les boutons de Reels ou Stories peuvent la masquer.",
      fixLabel: "Remonter"
    },
    fps: {
      id: "fps",
      number: "02",
      title: "Cadence non conforme au brief",
      detail: "Le brief demande 60 fps ; le projet est réglé à 30 fps.",
      fixLabel: "Passer à 60"
    }
  };

  function getIssues() {
    const issues = [];
    if (state.position === "low") issues.push(issueDefinitions.subtitle);
    if (state.fps !== 60) issues.push(issueDefinitions.fps);
    return issues;
  }

  function setPressState(group, selector, activeValue) {
    group.querySelectorAll(selector).forEach((button) => {
      const value = button.dataset.position || button.dataset.fps;
      button.setAttribute("aria-pressed", String(value === activeValue));
    });
  }

  function updateStatus(stage) {
    const issues = getIssues();

    if (stage === "scanning") {
      statusPill.textContent = "Analyse…";
      statusPill.dataset.tone = "scanning";
      timelineState.textContent = "Scan de livraison…";
      playhead.style.left = "82%";
      return;
    }

    if (stage === "issues") {
      statusPill.textContent = `${issues.length} bloquant${issues.length > 1 ? "s" : ""}`;
      statusPill.dataset.tone = "issue";
      timelineState.textContent = "Attention requise";
      playhead.style.left = "43%";
      return;
    }

    if (stage === "pass") {
      statusPill.textContent = "Prêt à livrer";
      statusPill.dataset.tone = "pass";
      timelineState.textContent = "Livraison validée";
      playhead.style.left = "78%";
      return;
    }

    statusPill.textContent = "À vérifier";
    statusPill.dataset.tone = "neutral";
    timelineState.textContent = "Prêt à contrôler";
    playhead.style.left = "0%";
  }

  function renderIssues(issues) {
    issueCount.textContent = `${issues.length} point${issues.length > 1 ? "s" : ""} bloquant${issues.length > 1 ? "s" : ""}`;
    issueList.replaceChildren();

    issues.forEach((issue) => {
      const item = document.createElement("div");
      item.className = "issue-item";
      item.innerHTML = `
        <span class="issue-number" aria-hidden="true">${issue.number}</span>
        <div class="issue-copy">
          <strong>${issue.title}</strong>
          <p>${issue.detail}</p>
        </div>
        <button class="issue-fix" type="button" data-fix-issue="${issue.id}">${issue.fixLabel}</button>
      `;
      issueList.append(item);
    });
  }

  function render(stage = state.activeStage) {
    const issues = getIssues();
    state.activeStage = stage;
    app.dataset.stage = stage;
    app.dataset.subtitle = state.position;

    setPressState(subtitlePosition, "button", state.position);
    setPressState(frameRate, "button", String(state.fps));
    fpsCaption.textContent = state.fps === 60 ? "Conforme au brief client" : "Le brief demande 60 fps";

    idleState.hidden = stage !== "idle";
    issuesState.hidden = stage !== "issues";
    passState.hidden = stage !== "pass";

    if (stage === "issues") renderIssues(issues);

    passTotal.textContent = "6";

    updateStatus(stage);
  }

  function showScanning(duration = 760) {
    clearTimeout(state.scanTimer);
    render("scanning");
    runCheckButton.disabled = true;
    const wait = prefersReducedMotion.matches ? 120 : duration;
    state.scanTimer = window.setTimeout(() => {
      runCheckButton.disabled = false;
      finishCheck();
    }, wait);
  }

  function finishCheck() {
    state.hasRun = true;
    const issues = getIssues();
    issues.forEach((issue) => state.foundIssues.add(issue.id));
    render(issues.length > 0 ? "issues" : "pass");
  }

  function setSetting(setting, value) {
    if (setting === "position") state.position = value;
    if (setting === "fps") state.fps = Number(value);

    if (state.hasRun) {
      const remaining = getIssues();
      const currentIds = new Set(remaining.map((issue) => issue.id));
      state.foundIssues.forEach((id) => {
        if (!currentIds.has(id)) state.correctedIssues.add(id);
      });
      render(remaining.length > 0 ? "issues" : "pass");
      return;
    }

    render("idle");
  }

  runCheckButton.addEventListener("click", () => showScanning());

  subtitlePosition.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-position]");
    if (!button) return;
    setSetting("position", button.dataset.position);
  });

  frameRate.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-fps]");
    if (!button) return;
    setSetting("fps", button.dataset.fps);
  });

  issueList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-fix-issue]");
    if (!button) return;
    const issue = button.dataset.fixIssue;
    if (issue === "subtitle") setSetting("position", "high");
    if (issue === "fps") setSetting("fps", "60");
  });

  fixAllButton.addEventListener("click", () => {
    state.position = "high";
    state.fps = 60;
    state.correctedIssues.add("subtitle");
    state.correctedIssues.add("fps");
    showScanning(560);
  });

  resetCheckButton.addEventListener("click", () => {
    clearTimeout(state.scanTimer);
    state.position = "low";
    state.fps = 30;
    state.hasRun = false;
    state.foundIssues.clear();
    state.correctedIssues.clear();
    state.generatedAt = null;
    render("idle");
    document.querySelector("#run-check").focus({ preventScroll: true });
  });

  function formatReceiptDate() {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      year: "numeric"
    }).format(state.generatedAt || new Date());
  }

  function receiptFileName() {
    return "bon-livraison-derniere-lumiere-ep04.txt";
  }

  function receiptText() {
    const date = formatReceiptDate();
    const code = receiptCode.textContent;
    return [
      "AVANT L’EXPORT — BON DE LIVRAISON (DÉMO)",
      "Projet fictif : Dernière lumière · épisode 04",
      "",
      `Code : ${code}`,
      `Contrôlé le : ${date}`,
      "Livraison : Réseaux sociaux · 9:16 · 00:28 · 60 fps · audio −14 LUFS",
      "",
      "CONTRÔLES PASSÉS",
      "[✓] Format et cadence : 9:16 · 60 fps",
      "[✓] Sous-titres français : hors zone d’interface",
      "[✓] Audio : −14 LUFS",
      "[✓] Validation interne : 1 destinataire",
      "",
      `Corrections appliquées : ${state.correctedIssues.size}`,
      "Bloquants restants : 0",
      "Exceptions : 0",
      "",
      "NOTE",
      "Le fichier peut être remis selon le brief.",
      "Ce bon de démonstration ne remplace pas la validation finale du client.",
      "",
      "Émis par : Dong Shengchao",
      "Scénario fictif · aucune donnée client · projet de démonstration",
      "",
      `Source de recherche : App Store France, 300 avis récents, fenêtre 2026-07-28 → 2026-11-14.`
    ].join("\n");
  }

  function openDialog(dialog) {
    document.body.classList.add("dialog-open");
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function closeDialog(dialog) {
    if (typeof dialog.close === "function") dialog.close();
    else dialog.removeAttribute("open");
    if (!document.querySelector("dialog[open]")) document.body.classList.remove("dialog-open");
  }

  emitReceiptButton.addEventListener("click", () => {
    state.generatedAt = new Date();
    receiptDate.textContent = formatReceiptDate();
    receiptCorrections.textContent = String(state.correctedIssues.size || (state.foundIssues.size > 0 ? 2 : 0));
    receiptCode.textContent = `AE-${String(state.generatedAt.getDate()).padStart(2, "0")}${String(state.generatedAt.getMonth() + 1).padStart(2, "0")}-04`;
    copyStatus.textContent = "";
    openDialog(receiptDialog);
  });

  closeReceiptButton.addEventListener("click", () => closeDialog(receiptDialog));
  closeNoteButton.addEventListener("click", () => closeDialog(noteDialog));
  closeNoteAction.addEventListener("click", () => closeDialog(noteDialog));
  openNoteButton.addEventListener("click", () => openDialog(noteDialog));

  [receiptDialog, noteDialog].forEach((dialog) => {
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog(dialog);
    });
    dialog.addEventListener("close", () => {
      if (!document.querySelector("dialog[open]")) document.body.classList.remove("dialog-open");
    });
  });

  copyReceiptButton.addEventListener("click", async () => {
    const text = receiptText();
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      copyStatus.textContent = "已复制";
    } catch (error) {
      copyStatus.textContent = "复制失败，请下载文本";
    }
  });

  downloadReceiptButton.addEventListener("click", () => {
    const blob = new Blob(["\ufeff", receiptText()], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = receiptFileName();
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  const jumpButton = document.querySelector("[data-jump-demo]");
  jumpButton?.addEventListener("click", () => {
    window.setTimeout(() => runCheckButton.focus({ preventScroll: true }), 420);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (receiptDialog.open) closeDialog(receiptDialog);
    if (noteDialog.open) closeDialog(noteDialog);
  });

  const dotPlot = document.querySelector("#dot-plot");
  if (dotPlot) {
    const stars = [
      ...Array(103).fill("1"),
      ...Array(25).fill("2"),
      ...Array(35).fill("3"),
      ...Array(47).fill("4"),
      ...Array(90).fill("5")
    ];
    const fragment = document.createDocumentFragment();
    stars.forEach((star) => {
      const dot = document.createElement("i");
      dot.dataset.star = star;
      fragment.append(dot);
    });
    dotPlot.append(fragment);
  }

  const quoteButtons = [...document.querySelectorAll("[data-quote]")];
  const quoteCounter = document.querySelector("#quote-counter");
  const quoteRating = document.querySelector("#quote-rating");
  const quoteFr = document.querySelector("#quote-fr");
  const quoteZh = document.querySelector("#quote-zh");
  const quoteId = document.querySelector("#quote-id");
  const quoteReading = document.querySelector("#quote-reading");
  const quoteSource = document.querySelector("#quote-source");
  const quoteStage = document.querySelector("#quote-stage");

  function setQuote(key) {
    const quote = quoteData[key];
    if (!quote) return;

    quoteButtons.forEach((button) => {
      const selected = button.dataset.quote === key;
      button.setAttribute("aria-selected", String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected) quoteStage.setAttribute("aria-labelledby", button.id);
    });

    quoteStage.classList.remove("is-changing");
    void quoteStage.offsetWidth;
    quoteStage.classList.add("is-changing");

    quoteCounter.textContent = quote.counter;
    quoteRating.textContent = quote.rating;
    quoteFr.textContent = quote.fr;
    quoteZh.textContent = quote.zh;
    quoteId.textContent = quote.id;
    quoteReading.textContent = quote.reading;
    quoteSource.href = quote.href;
  }

  quoteButtons.forEach((button) => {
    button.addEventListener("click", () => setQuote(button.dataset.quote));
  });

  document.querySelector(".quote-tabs").addEventListener("keydown", (event) => {
    const currentIndex = quoteButtons.indexOf(document.activeElement);
    if (currentIndex === -1) return;

    let nextIndex = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % quoteButtons.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + quoteButtons.length) % quoteButtons.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = quoteButtons.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextButton = quoteButtons[nextIndex];
    setQuote(nextButton.dataset.quote);
    nextButton.focus();
  });

  render("idle");
})();
