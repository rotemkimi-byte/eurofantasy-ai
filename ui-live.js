(() => {
  const pctText = value => {
    const n = Number(value || 0);
    return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
  };

  function addRefreshButton() {
    if (document.getElementById("refreshAllBtn")) return;

    const head = document.querySelector(".head");
    if (!head) return;

    const btn = document.createElement("button");
    btn.id = "refreshAllBtn";
    btn.className = "secondary";
    btn.textContent = "↻ רענן הכול";
    btn.style.fontSize = "12px";
    btn.style.padding = "8px 10px";
    btn.style.whiteSpace = "nowrap";

    btn.onclick = async () => {
      btn.disabled = true;
      btn.textContent = "מרענן…";

      const activeTab =
        document.querySelector(".tabs button.active")?.dataset?.tab;

      if (activeTab) {
        sessionStorage.setItem(
          "efa_active_tab",
          activeTab
        );
      }

      const badge =
        document.getElementById("syncBadge");

      if (badge) {
        badge.textContent = "מרענן נתונים…";
      }

      try {
        if (typeof syncOfficial === "function") {
          await Promise.race([
            syncOfficial(true),
            new Promise(resolve =>
              setTimeout(resolve, 4000)
            )
          ]);
        }
      } catch (error) {
        console.log("Official refresh:", error);
      }

      const url = new URL(window.location.href);
      url.searchParams.set("refresh", Date.now());
      window.location.replace(url.toString());
    };

    const badge =
      document.getElementById("syncBadge");

    if (badge && badge.parentNode) {
      badge.parentNode.insertBefore(btn, badge);
    } else {
      head.appendChild(btn);
    }
  }

  function enhanceMarketRows() {
    if (
      typeof players === "undefined" ||
      typeof model !== "function"
    ) {
      return;
    }

    const byName = new Map(
      players.map(p => [p.name, p])
    );

    document
      .querySelectorAll("#rows tr")
      .forEach(tr => {
        const name =
          tr.querySelector("td.name b")
            ?.textContent
            ?.trim();

        if (!name) return;

        const player = byName.get(name);
        if (!player) return;

        const cell = tr.children[7];
        if (!cell) return;

        const x = model(player);
        const value =
          Number(x.positionMatchPct || 0);

        let line =
          cell.querySelector(
            ".position-matchup-line"
          );

        if (!line) {
          line = document.createElement("div");
          line.className =
            "position-matchup-line";
          line.style.fontSize = "11px";
          line.style.fontWeight = "700";
          line.style.marginTop = "4px";
          cell.appendChild(line);
        }

        const text =
          `עמדה ${pctText(value)}`;

        if (line.textContent !== text) {
          line.textContent = text;
        }

        line.style.color =
          value >= 3
            ? "var(--accent)"
            : value <= -3
              ? "var(--bad)"
              : "var(--muted)";

        const games =
          x.positionMatchup?.sampleGames;

        line.title =
          games
            ? `מדגם: ${games} משחקים`
            : "אין מדגם נפרד לעמדה";
      });
  }

  function enhanceModal() {
    if (
      typeof players === "undefined" ||
      typeof model !== "function"
    ) {
      return;
    }

    const body =
      document.getElementById("modalBody");

    if (!body || !body.textContent) return;

    if (
      body.querySelector(
        ".position-matchup-modal"
      )
    ) {
      return;
    }

    const player =
      players.find(
        p => body.textContent.includes(p.name)
      );

    if (!player) return;

    const x = model(player);
    const value =
      Number(x.positionMatchPct || 0);

    const grid = body.querySelector('.detailGrid');
    if (grid && !body.querySelector('.actual-results')) {
      const recent = x.recentForm;
      const current = recent?.latestSeason === 'E2026' && Number(recent.currentSeasonGames) > 0;
      const actual = document.createElement('section');
      actual.className = 'dataGroup actual actual-results';
      const heading = document.createElement('h3');
      heading.className = 'sectionTitle';
      heading.textContent = 'בפועל · עונת 2026/27';
      actual.appendChild(heading);
      const metrics = document.createElement('div');
      metrics.className = 'metricRow';
      const items = current ? [
        ['משחק אחרון · PIR', recent.lastGame?.pir],
        ['משחק אחרון · דקות', recent.lastGame?.minutes],
        [`ממוצע ${recent.last5?.games || 0} אחרונים · PIR`, recent.last5?.avgPir],
        ['משחקים העונה', recent.currentSeasonGames]
      ] : [];
      if (items.length) {
        for (const [label, value] of items) {
          const tile = document.createElement('div');
          tile.className = 'metric';
          const num = document.createElement('b');
          num.textContent = value == null || !Number.isFinite(Number(value)) ? '—' : Number(value).toFixed(label === 'משחקים העונה' ? 0 : 1);
          const caption = document.createElement('span');
          caption.textContent = label;
          tile.append(num, caption);
          metrics.appendChild(tile);
        }
        actual.appendChild(metrics);
      } else {
        const empty = document.createElement('p');
        empty.className = 'muted';
        empty.textContent = 'אין עדיין נתוני משחק מאומתים לעונה הנוכחית.';
        actual.appendChild(empty);
      }
      grid.before(actual);
      const forecast = document.createElement('h3');
      forecast.className = 'sectionTitle';
      forecast.textContent = 'תחזית · המשחק הבא';
      grid.before(forecast);
    }

    const box =
      document.createElement("div");

    box.className =
      "notice position-matchup-modal";
    box.style.marginTop = "10px";

    const games =
      x.positionMatchup?.sampleGames;

    box.textContent =
      `מאצ׳אפ לפי עמדה (${player.pos}): ` +
      `${pctText(value)}` +
      (games
        ? ` • מדגם ${games} משחקים`
        : "");

    body.appendChild(box);
  }


  function enhanceTeamRecentStats() {
    if (
      typeof players === "undefined" ||
      typeof model !== "function"
    ) {
      return;
    }

    document
      .querySelectorAll(
        "#teamCards .miniCard"
      )
      .forEach(card => {
        const name =
          card.querySelector(
            ".sectionHead b"
          )?.textContent?.trim();

        if (!name) return;

        const player =
          players.find(
            p => p.name === name
          );

        if (!player) return;

        const x = model(player);
        const recent = x.recentForm;

        if (!recent) return;

        const chips = card.querySelector('.chips');
        if (!chips) return;
        let actualGroup = card.querySelector('.team-actual');
        if (!actualGroup) {
          actualGroup = document.createElement('div');
          actualGroup.className = 'dataGroup actual team-actual';
          const title = document.createElement('div');
          title.className = 'sectionTitle';
          title.textContent = 'בפועל · 2026/27';
          actualGroup.appendChild(title);
          chips.after(actualGroup);
        }

        let lastChip =
          actualGroup.querySelector(
            ".recent-last-chip"
          );

        if (!lastChip) {
          lastChip =
            document.createElement(
              "span"
            );
          lastChip.className =
            "chip recent-last-chip";
          actualGroup.appendChild(lastChip);
        }

        let avg5Chip =
          actualGroup.querySelector(
            ".recent-avg5-chip"
          );

        if (!avg5Chip) {
          avg5Chip =
            document.createElement(
              "span"
            );
          avg5Chip.className =
            "chip recent-avg5-chip";
          actualGroup.appendChild(avg5Chip);
        }

        const last = recent.lastGame?.pir == null ? NaN : Number(recent.lastGame.pir);
        const avg5 = recent.last5?.avgPir == null ? NaN : Number(recent.last5.avgPir);

        lastChip.textContent =
          recent.latestSeason === 'E2026' && Number(recent.currentSeasonGames) > 0 && Number.isFinite(last)
            ? `אחרון ${last.toFixed(1)} PIR`
            : "אחרון —";

        avg5Chip.textContent =
          recent.latestSeason === 'E2026' && Number(recent.currentSeasonGames) > 0 && Number.isFinite(avg5)
            ? `5 אחרונים ${avg5.toFixed(1)}`
            : "5 אחרונים —";
      });
  }

  function restoreTab() {
    const saved =
      sessionStorage.getItem(
        "efa_active_tab"
      );

    if (!saved) return;

    sessionStorage.removeItem(
      "efa_active_tab"
    );

    const button =
      document.querySelector(
        `.tabs button[data-tab="${saved}"]`
      );

    if (button) {
      button.click();
    }
  }

  function start() {
    addRefreshButton();
    enhanceMarketRows();
    enhanceModal();
    enhanceTeamRecentStats();

    const rows =
      document.getElementById("rows");

    if (rows) {
      new MutationObserver(() => {
        requestAnimationFrame(
          enhanceMarketRows
        );
      }).observe(
        rows,
        { childList: true }
      );
    }


    const teamCards =
      document.getElementById("teamCards");

    if (teamCards) {
      new MutationObserver(() => {
        requestAnimationFrame(
          enhanceTeamRecentStats
        );
      }).observe(
        teamCards,
        {
          childList: true,
          subtree: true
        }
      );
    }

    const modalBody =
      document.getElementById("modalBody");

    if (modalBody) {
      new MutationObserver(() => {
        requestAnimationFrame(
          enhanceModal
        );
      }).observe(
        modalBody,
        { childList: true }
      );
    }

    setTimeout(restoreTab, 250);
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      start
    );
  } else {
    start();
  }
})();
