(async () => {
  try {
    const response = await fetch(
      "./data/recent-form.json?t="
      + Date.now(),
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(
        "recent-form.json HTTP "
        + response.status
      );
    }

    const payload =
      await response.json();

    const form =
      payload.players || {};

    const sleep = ms =>
      new Promise(resolve =>
        setTimeout(resolve, ms)
      );

    // Position matchup is another model layer.
    // Give it a moment to install first so this layer
    // can use both team and positional matchup fields.
    for (
      let i = 0;
      i < 50
      && !window.__positionMatchupsPatched;
      i++
    ) {
      await sleep(100);
    }

    if (
      typeof model !== "function"
      ||
      typeof renderAll !== "function"
    ) {
      throw new Error(
        "EuroFantasy model is not ready"
      );
    }

    if (
      window.__recentFormPatched
    ) {
      return;
    }

    window.__recentFormPatched = true;
    window.__recentFormData = payload;

    const originalModel = model;

    const norm = value =>
      String(value || "")
        .normalize("NFD")
        .replace(
          /[\u0300-\u036f]/g,
          ""
        )
        .toLowerCase()
        .replace(
          /[^a-z0-9 ]/g,
          " "
        )
        .replace(/\s+/g, " ")
        .trim();

    const clampValue = (
      x,
      min,
      max
    ) => Math.max(
      min,
      Math.min(max, x)
    );

    model = function (p) {
      const x =
        originalModel(p);

      const recent =
        form[norm(p.name)];

      if (
        !recent
        || p.status === "out"
      ) {
        x.recentForm =
          recent || null;
        return x;
      }

      const rate = Number(
        recent
          .model
          ?.formPirPerMinute
      );

      const recentMinutes =
        Number(
          recent
            .model
            ?.recentMinutes
        );

      if (
        !Number.isFinite(rate)
        || rate <= 0
        || !Number.isFinite(
          recentMinutes
        )
        || recentMinutes <= 0
      ) {
        x.recentForm = recent;
        return x;
      }

      // Existing x.minutes already contains injury,
      // availability and blowout logic. Blend it with
      // the recent rotation instead of replacing it.
      const modelBaseMinutes =
        Number(
          x.baseMin
          || x.minutes
          || recentMinutes
        );

      const availabilityFactor =
        modelBaseMinutes > 0
          ? clampValue(
              Number(x.minutes)
              / modelBaseMinutes,
              0,
              1.25
            )
          : 1;

      let predictedMinutes =
        (
          recentMinutes * 0.70
          + Number(x.minutes) * 0.30
        )
        * availabilityFactor;

      predictedMinutes =
        clampValue(
          predictedMinutes,
          5,
          36
        );

      const teamPct =
        Number(
          x.teamMatchPct
          ?? x.matchPct
          ?? 0
        );

      const positionPct =
        Number(
          x.positionMatchPct
          ?? 0
        );

      // Matchups matter, but are deliberately damped
      // so we don't double-count opponent effects.
      const teamFactor =
        1
        + clampValue(
            teamPct,
            -8,
            8
          )
          / 100
          * 0.60;

      const positionFactor =
        1
        + clampValue(
            positionPct,
            -12,
            12
          )
          / 100
          * 0.35;

      const oldExpected =
        Math.max(
          0.01,
          Number(x.expected || 0.01)
        );

      const newExpected =
        Math.max(
          0,
          rate
          * predictedMinutes
          * teamFactor
          * positionFactor
        );

      const floorRatio =
        Number(x.floor || 0)
        / oldExpected;

      const ceilingRatio =
        Number(x.ceiling || 0)
        / oldExpected;

      x.expected = newExpected;
      x.minutes = predictedMinutes;

      x.floor = Math.max(
        0,
        newExpected
        * clampValue(
            floorRatio,
            0.45,
            0.90
          )
      );

      x.ceiling =
        newExpected
        * clampValue(
            ceilingRatio,
            1.15,
            1.75
          );

      x.value =
        newExpected
        / Math.max(
            0.1,
            Number(p.price)
          );

      x.source =
        "Recent form blend";

      x.recentForm = recent;
      x.recentLastPir =
        recent.lastGame?.pir;

      x.recentAvg5Pir =
        recent.last5?.avgPir;

      x.recentAvg10Pir =
        recent.last10?.avgPir;

      x.recentRate = rate;
      x.recentMinutes =
        recentMinutes;

      x.teamMatchPctApplied =
        (teamFactor - 1) * 100;

      x.positionMatchPctApplied =
        (
          positionFactor - 1
        ) * 100;

      return x;
    };

    const addRecentToModal = () => {
      const body =
        document.getElementById(
          "modalBody"
        );

      if (
        !body
        || body.querySelector(
          ".recent-form-box"
        )
      ) {
        return;
      }

      if (
        typeof players === "undefined"
      ) {
        return;
      }

      const p =
        players.find(
          player =>
            body.textContent.includes(
              player.name
            )
        );

      if (!p) return;

      const x = model(p);
      const r = x.recentForm;

      if (!r) return;

      const box =
        document.createElement(
          "div"
        );

      box.className =
        "notice recent-form-box";

      box.style.marginTop =
        "10px";

      const last =
        Number(
          r.lastGame?.pir
        );

      const avg5 =
        Number(
          r.last5?.avgPir
        );

      const avg10 =
        Number(
          r.last10?.avgPir
        );

      box.textContent =
        `כושר אחרון: ` +
        `משחק אחרון ${last.toFixed(1)} PIR` +
        ` • 5 אחרונים ${avg5.toFixed(1)}` +
        ` • 10 אחרונים ${avg10.toFixed(1)}` +
        ` • משקל המשחק האחרון 40%`;

      body.appendChild(box);
    };

    const modalBody =
      document.getElementById(
        "modalBody"
      );

    if (modalBody) {
      new MutationObserver(() => {
        requestAnimationFrame(
          addRecentToModal
        );
      }).observe(
        modalBody,
        {
          childList: true
        }
      );
    }

    renderAll();

    console.log(
      "Recent-form model active:",
      Object.keys(form).length,
      "players"
    );

  } catch (error) {
    console.error(
      "Recent-form model error:",
      error
    );
  }
})();
