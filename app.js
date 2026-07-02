(function () {
  const storageKey = "visual-portfolio-planner:v1";
  const actualStorageKey = "visual-portfolio-planner:actual:v1";
  const palette = ["#176b87", "#9b5d35", "#217247", "#7d4f9f", "#b23a48", "#2f6f73", "#b2842f", "#345995"];
  const makeId = () => {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  };

  const demoPortfolio = {
    id: makeId(),
    name: "Portafolio",
    value: 100000,
    items: [
      {
        id: makeId(),
        name: "Bonos",
        percent: 35,
        color: palette[0],
        items: [
          { id: makeId(), name: "Soberanos", percent: 55, color: palette[6], items: [] },
          { id: makeId(), name: "Corporativos", percent: 30, color: palette[1], items: [] },
          { id: makeId(), name: "Letras", percent: 15, color: palette[2], items: [] }
        ]
      },
      {
        id: makeId(),
        name: "Acciones",
        percent: 45,
        color: palette[2],
        items: [
          { id: makeId(), name: "NVIDIA", percent: 50, color: palette[3], items: [] },
          { id: makeId(), name: "Meta", percent: 25, color: palette[4], items: [] },
          { id: makeId(), name: "Google", percent: 25, color: palette[5], items: [] }
        ]
      },
      { id: makeId(), name: "Cripto", percent: 20, color: palette[4], items: [] }
    ]
  };

  let portfolio = loadPortfolio();
  let actualPositions = loadActualPositions();
  let selectedImageFiles = [];
  let selectedPath = [];
  let breakdownSort = "largest";

  const els = {
    treemap: document.getElementById("treemap"),
    breadcrumbs: document.getElementById("breadcrumbs"),
    allocationList: document.getElementById("allocationList"),
    template: document.getElementById("allocationRowTemplate"),
    editorTitle: document.getElementById("editorTitle"),
    currentGroupName: document.getElementById("currentGroupName"),
    assignedMetric: document.getElementById("assignedMetric"),
    availableMetric: document.getElementById("availableMetric"),
    statusText: document.getElementById("statusText"),
    addButton: document.getElementById("addButton"),
    form: document.getElementById("quickAddForm"),
    nameInput: document.getElementById("nameInput"),
    percentInput: document.getElementById("percentInput"),
    portfolioValueInput: document.getElementById("portfolioValueInput"),
    portfolioValueDisplay: document.getElementById("portfolioValueDisplay"),
    breakdownSortButtons: document.querySelectorAll("[data-breakdown-sort]"),
    breakdownList: document.getElementById("breakdownList"),
    actualImagesInput: document.getElementById("actualImagesInput"),
    imagePreviewList: document.getElementById("imagePreviewList"),
    scanImagesButton: document.getElementById("scanImagesButton"),
    scanStatus: document.getElementById("scanStatus"),
    ocrTextInput: document.getElementById("ocrTextInput"),
    parseTextButton: document.getElementById("parseTextButton"),
    addActualButton: document.getElementById("addActualButton"),
    clearActualButton: document.getElementById("clearActualButton"),
    actualList: document.getElementById("actualList"),
    rebalanceTableBody: document.getElementById("rebalanceTableBody"),
    exportButton: document.getElementById("exportButton"),
    importInput: document.getElementById("importInput"),
    resetDemoButton: document.getElementById("resetDemoButton")
  };

  function loadPortfolio() {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return structuredClone(demoPortfolio);

    try {
      const parsed = JSON.parse(saved);
      const cleanPortfolio = sanitizeGroup(parsed, "Portafolio");
      if (parsed.value == null) {
        cleanPortfolio.value = demoPortfolio.value;
      }
      return cleanPortfolio;
    } catch {
      return structuredClone(demoPortfolio);
    }
  }

  function loadActualPositions() {
    const saved = localStorage.getItem(actualStorageKey);
    if (!saved) return [];

    try {
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.map(sanitizeActualPosition);
    } catch {
      return [];
    }
  }

  function sanitizeActualPosition(position) {
    return {
      id: position.id || makeId(),
      name: String(position.name || "Activo"),
      amount: clampMoney(position.amount),
      planId: position.planId || ""
    };
  }

  function sanitizeGroup(group, fallbackName) {
    return {
      id: group.id || makeId(),
      name: String(group.name || fallbackName),
      value: clampMoney(group.value),
      percent: Number(group.percent || 0),
      color: group.color || palette[0],
      items: Array.isArray(group.items)
        ? group.items.map((item, index) => sanitizeItem(item, index))
        : []
    };
  }

  function sanitizeItem(item, index) {
    const clean = sanitizeGroup(item, `Grupo ${index + 1}`);
    clean.percent = clampPercent(clean.percent);
    clean.color = item.color || palette[index % palette.length];
    return clean;
  }

  function savePortfolio() {
    localStorage.setItem(storageKey, JSON.stringify(portfolio));
  }

  function saveActualPositions() {
    localStorage.setItem(actualStorageKey, JSON.stringify(actualPositions));
  }

  function clampPercent(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.min(100, Math.max(0, number));
  }

  function clampMoney(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 0;
    return Math.max(0, number);
  }

  function formatPercent(value) {
    const fixed = Number(value.toFixed(2));
    return `${fixed}%`;
  }

  function formatMoney(value) {
    const absoluteValue = Math.abs(value);
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: absoluteValue >= 1000 ? 0 : 2
    }).format(value);
  }

  function parseMoney(value) {
    const text = String(value || "").trim();
    if (!text) return 0;

    let cleaned = text.replace(/[^\d,.-]/g, "");
    const sign = cleaned.includes("-") ? -1 : 1;
    cleaned = cleaned.replace(/-/g, "");

    const lastSeparator = Math.max(cleaned.lastIndexOf("."), cleaned.lastIndexOf(","));
    const decimalPart = lastSeparator >= 0 ? cleaned.slice(lastSeparator + 1) : "";
    const hasDecimalPart = decimalPart.length > 0 && decimalPart.length <= 2;
    const integerPart = hasDecimalPart ? cleaned.slice(0, lastSeparator) : cleaned;
    const normalized = hasDecimalPart
      ? `${integerPart.replace(/[.,]/g, "")}.${decimalPart}`
      : integerPart.replace(/[.,]/g, "");
    return clampMoney(sign * Number(normalized));
  }

  function normalizeName(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function similarityScore(source, target) {
    const sourceName = normalizeName(source);
    const targetName = normalizeName(target);
    if (!sourceName || !targetName) return 0;
    if (sourceName === targetName) return 1;
    if (sourceName.includes(targetName) || targetName.includes(sourceName)) return 0.86;

    const sourceWords = new Set(sourceName.split(" ").filter(Boolean));
    const targetWords = new Set(targetName.split(" ").filter(Boolean));
    const hits = [...sourceWords].filter((word) => targetWords.has(word)).length;
    return hits / Math.max(sourceWords.size, targetWords.size, 1);
  }

  function hexToRgba(hex, alpha) {
    const cleanHex = /^#[0-9a-f]{6}$/i.test(hex) ? hex.slice(1) : "176b87";
    const red = parseInt(cleanHex.slice(0, 2), 16);
    const green = parseInt(cleanHex.slice(2, 4), 16);
    const blue = parseInt(cleanHex.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function getSelectedGroup() {
    return selectedPath.reduce((group, id) => group.items.find((item) => item.id === id) || group, portfolio);
  }

  function getCrumbs() {
    const crumbs = [{ id: null, name: portfolio.name }];
    let group = portfolio;
    selectedPath.forEach((id) => {
      const next = group.items.find((item) => item.id === id);
      if (next) {
        crumbs.push({ id, name: next.name });
        group = next;
      }
    });
    return crumbs;
  }

  function getLayouts(items, width, height) {
    const total = items.reduce((sum, item) => sum + item.percent, 0);
    const visibleItems = items.map((item) => ({ ...item, layoutPercent: item.percent }));

    if (total < 100) {
      visibleItems.push({
        id: "empty",
        name: "Disponible",
        percent: 100 - total,
        layoutPercent: 100 - total,
        color: "#eee7da",
        empty: true,
        items: []
      });
    }

    const denominator = total > 100 ? total : 100;
    const area = width * height;
    const nodes = visibleItems
      .map((item) => ({
        item,
        area: denominator === 0 ? 0 : (item.layoutPercent / denominator) * area
      }))
      .filter((node) => node.area > 0);

    return squarify(nodes, { x: 0, y: 0, width, height });
  }

  function squarify(nodes, rect) {
    const remaining = [...nodes];
    const layouts = [];
    let row = [];
    let currentRect = { ...rect };

    while (remaining.length > 0) {
      const node = remaining[0];
      const side = Math.min(currentRect.width, currentRect.height);
      const candidateRow = [...row, node];

      if (row.length === 0 || worstRatio(candidateRow, side) <= worstRatio(row, side)) {
        row.push(remaining.shift());
      } else {
        currentRect = layoutRow(row, currentRect, layouts);
        row = [];
      }
    }

    if (row.length > 0) {
      layoutRow(row, currentRect, layouts);
    }

    return layouts;
  }

  function worstRatio(row, side) {
    if (row.length === 0 || side === 0) return Infinity;

    const areas = row.map((node) => node.area);
    const sum = areas.reduce((total, area) => total + area, 0);
    const max = Math.max(...areas);
    const min = Math.min(...areas);
    const sideSquared = side * side;

    return Math.max((sideSquared * max) / (sum * sum), (sum * sum) / (sideSquared * min));
  }

  function layoutRow(row, rect, layouts) {
    const rowArea = row.reduce((total, node) => total + node.area, 0);

    if (shouldPreferHorizontalRemainder(row, rect, rowArea)) {
      return layoutHorizontalRow(row, rect, layouts, rowArea);
    }

    if (rect.width >= rect.height) {
      return layoutVerticalRow(row, rect, layouts, rowArea);
    }

    return layoutHorizontalRow(row, rect, layouts, rowArea);
  }

  function shouldPreferHorizontalRemainder(row, rect, rowArea) {
    if (row.length !== 1 || rect.width < rect.height) return false;

    const totalArea = rect.width * rect.height;
    if (totalArea === 0) return false;

    const usedRatio = rowArea / totalArea;
    const verticalRemainderWidth = rect.width - rowArea / rect.height;
    const horizontalRemainderHeight = rect.height - rowArea / rect.width;
    const verticalRemainderIsThin = verticalRemainderWidth / rect.width < 0.12;
    const horizontalRemainderIsUsable = horizontalRemainderHeight / rect.height >= 0.015;

    return usedRatio > 0.78 && verticalRemainderIsThin && horizontalRemainderIsUsable;
  }

  function layoutVerticalRow(row, rect, layouts, rowArea) {
    const rowWidth = rowArea / rect.height;
    let y = rect.y;

    row.forEach((node, index) => {
      const isLast = index === row.length - 1;
      const itemHeight = isLast ? rect.y + rect.height - y : node.area / rowWidth;
      layouts.push({
        item: node.item,
        x: rect.x,
        y,
        width: rowWidth,
        height: itemHeight
      });
      y += itemHeight;
    });

    return {
      x: rect.x + rowWidth,
      y: rect.y,
      width: Math.max(0, rect.width - rowWidth),
      height: rect.height
    };
  }

  function layoutHorizontalRow(row, rect, layouts, rowArea) {
    const rowHeight = rowArea / rect.width;
    let x = rect.x;

    row.forEach((node, index) => {
      const isLast = index === row.length - 1;
      const itemWidth = isLast ? rect.x + rect.width - x : node.area / rowHeight;
      layouts.push({
        item: node.item,
        x,
        y: rect.y,
        width: itemWidth,
        height: rowHeight
      });
      x += itemWidth;
    });

    return {
      x: rect.x,
      y: rect.y + rowHeight,
      width: rect.width,
      height: Math.max(0, rect.height - rowHeight)
    };
  }

  function renderTreemap() {
    const group = getSelectedGroup();
    els.treemap.innerHTML = "";

    getLayouts(group.items, 100, 100).forEach(({ item, x, y, width, height }) => {
      if (width <= 0 || height <= 0) return;

      const button = document.createElement("button");
      button.type = "button";
      const hasChildren = !item.empty && item.items.length > 0;
      button.className = `tile${item.empty ? " tile-empty" : ""}${hasChildren ? " tile-has-children" : ""}${width * height < 500 ? " tile-small" : ""}`;
      button.style.left = `${x}%`;
      button.style.top = `${y}%`;
      button.style.width = `${width}%`;
      button.style.height = `${height}%`;
      button.style.background = item.color;
      button.style.setProperty("--parent-overlay", hexToRgba(item.color, 0.52));
      button.setAttribute("aria-label", `${item.name}, ${formatPercent(item.percent)}`);
      button.title = `${item.name} ${formatPercent(item.percent)}`;

      if (hasChildren) {
        const nested = document.createElement("span");
        nested.className = "tile-nested";
        getLayouts(item.items, 100, 100).forEach(({ item: child, x: childX, y: childY, width: childWidth, height: childHeight }) => {
          const childTile = document.createElement("span");
          childTile.className = "nested-tile";
          childTile.style.left = `${childX}%`;
          childTile.style.top = `${childY}%`;
          childTile.style.width = `${childWidth}%`;
          childTile.style.height = `${childHeight}%`;
          childTile.style.background = child.empty ? "rgba(255, 253, 248, 0.38)" : hexToRgba(child.color, 0.8);
          nested.appendChild(childTile);
        });
        button.appendChild(nested);

        const overlay = document.createElement("span");
        overlay.className = "tile-parent-overlay";
        button.appendChild(overlay);
      }

      const content = document.createElement("span");
      content.className = "tile-content";
      content.innerHTML = `<span class="tile-name"></span><span class="tile-percent"></span>`;
      content.querySelector(".tile-name").textContent = item.name;
      content.querySelector(".tile-percent").textContent = formatPercent(item.percent);
      button.appendChild(content);

      if (!item.empty) {
        button.addEventListener("click", () => {
          selectedPath.push(item.id);
          render();
        });
      }

      els.treemap.appendChild(button);
    });

    requestAnimationFrame(fitTileLabels);
  }

  function fitTileLabels() {
    els.treemap.querySelectorAll(".tile").forEach((tile) => {
      const name = tile.querySelector(".tile-name");
      const percent = tile.querySelector(".tile-percent");
      if (!name || !percent) return;

      tile.classList.remove("tile-label-compact", "tile-label-name-only");
      tile.style.removeProperty("--tile-label-size");

      const rect = tile.getBoundingClientRect();
      const textLength = name.textContent.length;
      const isShortStrip = rect.height < 54 && rect.width > rect.height * 3;
      const isNarrowTile = rect.width < 86;
      const shouldCompact = isShortStrip || isNarrowTile;

      if (shouldCompact) {
        tile.classList.add("tile-label-compact");
        const heightSize = Math.max(8, Math.min(18, rect.height * 0.44));
        const widthSize = Math.max(8, Math.min(18, (rect.width - 22) / Math.max(4, textLength * 0.62)));
        const labelSize = Math.floor(Math.min(heightSize, widthSize));
        tile.style.setProperty("--tile-label-size", `${labelSize}px`);

        const estimatedNameWidth = textLength * labelSize * 0.62;
        const estimatedPercentWidth = percent.textContent.length * labelSize * 0.62 + 12;
        if (rect.height < 32 || estimatedNameWidth + estimatedPercentWidth > rect.width - 18) {
          tile.classList.add("tile-label-name-only");
        }
      }

    });
  }

  function renderBreadcrumbs() {
    els.breadcrumbs.innerHTML = "";
    getCrumbs().forEach((crumb, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "crumb";
      button.textContent = crumb.name;
      if (index === selectedPath.length) {
        button.setAttribute("aria-current", "page");
      }
      button.addEventListener("click", () => {
        selectedPath = selectedPath.slice(0, index);
        render();
      });
      els.breadcrumbs.appendChild(button);
    });
  }

  function renderMetrics(group) {
    const assigned = group.items.reduce((sum, item) => sum + item.percent, 0);
    const available = 100 - assigned;
    els.currentGroupName.textContent = group.name;
    els.editorTitle.textContent = group.name;
    els.assignedMetric.textContent = formatPercent(assigned);
    els.availableMetric.textContent = formatPercent(Math.max(0, available));

    els.statusText.className = "status";
    if (assigned > 100) {
      els.statusText.textContent = `Hay ${formatPercent(assigned - 100)} por encima de 100%. La vista lo reparte proporcionalmente.`;
      els.statusText.classList.add("warning");
    } else if (assigned === 100) {
      els.statusText.textContent = "Asignación completa.";
      els.statusText.classList.add("good");
    } else {
      els.statusText.textContent = `Queda ${formatPercent(available)} sin asignar.`;
    }
  }

  function getRankedItems(items) {
    return items
      .map((item, index) => ({ item, index }))
      .sort((a, b) => b.item.percent - a.item.percent || a.index - b.index)
      .map((entry, index) => ({
        ...entry,
        rank: index + 1
      }));
  }

  function getBreakdownRows(items, parentTotalPercent = 100, depth = 0) {
    const rankedItems = getRankedItems(items);
    const displayItems = breakdownSort === "largest"
      ? rankedItems
      : [...rankedItems].sort((a, b) => a.index - b.index);

    return displayItems.flatMap(({ item, rank }) => {
      const totalPercent = (parentTotalPercent * item.percent) / 100;
      const currentRow = {
        id: item.id,
        name: item.name,
        color: item.color,
        rank,
        depth,
        percent: item.percent,
        totalPercent,
        amount: (portfolio.value * totalPercent) / 100
      };

      return [currentRow, ...getBreakdownRows(item.items, totalPercent, depth + 1)];
    });
  }

  function getPlanPositionRows(items = portfolio.items, parentTotalPercent = 100, path = []) {
    return items.flatMap((item) => {
      const totalPercent = (parentTotalPercent * item.percent) / 100;
      const currentPath = [...path, item.name];
      if (item.items.length > 0) {
        return getPlanPositionRows(item.items, totalPercent, currentPath);
      }

      return [{
        id: item.id,
        name: item.name,
        path: currentPath.join(" / "),
        color: item.color,
        totalPercent,
        targetAmount: (portfolio.value * totalPercent) / 100
      }];
    });
  }

  function findBestPlanMatch(name) {
    const planRows = getPlanPositionRows();
    let best = { id: "", score: 0 };
    planRows.forEach((row) => {
      const score = Math.max(similarityScore(name, row.name), similarityScore(name, row.path));
      if (score > best.score) {
        best = { id: row.id, score };
      }
    });
    return best.score >= 0.45 ? best.id : "";
  }

  function parseActualPositionsFromText(text) {
    return String(text || "")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/(.+?)\s+([$€£]?\s*-?\d[\d.,\s]*)$/) || line.match(/^([$€£]?\s*-?\d[\d.,\s]*)\s+(.+)$/);
        if (!match) return null;

        const firstPartIsMoney = /^\s*[$€£]?\s*-?\d/.test(match[1]);
        const rawName = firstPartIsMoney ? match[2] : match[1];
        const rawAmount = firstPartIsMoney ? match[1] : match[2];
        const amount = parseMoney(rawAmount);
        const name = rawName.replace(/\s{2,}/g, " ").trim();
        if (!name || amount <= 0) return null;

        return {
          id: makeId(),
          name,
          amount,
          planId: findBestPlanMatch(name)
        };
      })
      .filter(Boolean);
  }

  function renderBreakdown() {
    const rows = getBreakdownRows(portfolio.items);

    els.portfolioValueInput.value = portfolio.value || "";
    els.portfolioValueDisplay.textContent = formatMoney(portfolio.value);
    els.breakdownSortButtons.forEach((button) => {
      const isActive = button.dataset.breakdownSort === breakdownSort;
      button.classList.toggle("active", isActive);
      button.setAttribute("aria-pressed", String(isActive));
    });
    els.breakdownList.innerHTML = "";

    if (rows.length === 0) {
      const empty = document.createElement("p");
      empty.className = "breakdown-empty";
      empty.textContent = "Agregá grupos para ver el desglose.";
      els.breakdownList.appendChild(empty);
      return;
    }

    rows.forEach((row) => {
      const item = document.createElement("article");
      item.className = "breakdown-row";
      item.style.setProperty("--depth", row.depth);
      item.style.setProperty("--row-color", row.color);
      item.style.setProperty("--bar-width", `${Math.min(100, row.totalPercent)}%`);

      item.innerHTML = `
        <div class="breakdown-main">
          <span class="rank-badge"></span>
          <span class="breakdown-color" aria-hidden="true"></span>
          <span class="breakdown-name"></span>
          <strong class="breakdown-money"></strong>
        </div>
        <div class="breakdown-bar" aria-hidden="true"><span></span></div>
        <div class="breakdown-meta">
          <span class="local-percent"></span>
          <span class="total-percent"></span>
        </div>
      `;

      const rankBadge = item.querySelector(".rank-badge");
      rankBadge.textContent = row.rank;
      rankBadge.classList.add(`rank-${Math.min(row.rank, 4)}`);
      item.querySelector(".breakdown-name").textContent = row.name;
      item.querySelector(".breakdown-money").textContent = formatMoney(row.amount);
      item.querySelector(".local-percent").textContent = row.depth === 0
        ? `${formatPercent(row.percent)} del portafolio`
        : `${formatPercent(row.percent)} del grupo`;
      item.querySelector(".total-percent").textContent = `${formatPercent(row.totalPercent)} del total`;
      els.breakdownList.appendChild(item);
    });
  }

  function renderActualPositions() {
    const planRows = getPlanPositionRows();
    const planById = new Map(planRows.map((row) => [row.id, row]));

    els.actualList.innerHTML = "";
    if (actualPositions.length === 0) {
      const empty = document.createElement("p");
      empty.className = "breakdown-empty";
      empty.textContent = "Todavía no hay posiciones reales cargadas.";
      els.actualList.appendChild(empty);
    } else {
      actualPositions.forEach((position, index) => {
        const row = document.createElement("article");
        row.className = "actual-row";
        row.innerHTML = `
          <input class="actual-name-input" type="text" aria-label="Nombre real">
          <input class="actual-money-input" type="number" min="0" step="100" aria-label="Monto actual">
          <select class="actual-plan-select" aria-label="Activo del plan"></select>
          <button class="row-button delete-button" type="button" aria-label="Eliminar posición" title="Eliminar">×</button>
        `;

        const nameInput = row.querySelector(".actual-name-input");
        const moneyInput = row.querySelector(".actual-money-input");
        const planSelect = row.querySelector(".actual-plan-select");
        const deleteButton = row.querySelector(".delete-button");

        nameInput.value = position.name;
        moneyInput.value = position.amount || "";
        planSelect.innerHTML = `<option value="">Sin vincular</option>${planRows.map((planRow) => (
          `<option value="${planRow.id}">${planRow.path}</option>`
        )).join("")}`;
        planSelect.value = planById.has(position.planId) ? position.planId : "";

        nameInput.addEventListener("input", () => {
          position.name = nameInput.value || `Posición ${index + 1}`;
          if (!position.planId) {
            position.planId = findBestPlanMatch(position.name);
          }
          saveActualPositions();
          renderRebalanceTable();
        });

        moneyInput.addEventListener("input", () => {
          position.amount = clampMoney(moneyInput.value);
          saveActualPositions();
          renderRebalanceTable();
        });

        planSelect.addEventListener("change", () => {
          position.planId = planSelect.value;
          saveActualPositions();
          renderRebalanceTable();
        });

        deleteButton.addEventListener("click", () => {
          actualPositions = actualPositions.filter((candidate) => candidate.id !== position.id);
          saveActualPositions();
          renderActualPositions();
        });

        els.actualList.appendChild(row);
      });
    }

    renderRebalanceTable();
  }

  function renderRebalanceTable() {
    const planRows = getPlanPositionRows();
    const planIds = new Set(planRows.map((row) => row.id));
    const actualByPlan = new Map();

    actualPositions.forEach((position) => {
      if (!position.planId || !planIds.has(position.planId)) return;
      actualByPlan.set(position.planId, (actualByPlan.get(position.planId) || 0) + position.amount);
    });

    els.rebalanceTableBody.innerHTML = "";
    if (planRows.length === 0) {
      const emptyRow = document.createElement("tr");
      emptyRow.innerHTML = `<td colspan="4">Agregá activos al plan para ver la comparación.</td>`;
      els.rebalanceTableBody.appendChild(emptyRow);
      return;
    }

    planRows
      .map((row) => ({
        ...row,
        actualAmount: actualByPlan.get(row.id) || 0
      }))
      .sort((a, b) => b.targetAmount - a.targetAmount)
      .forEach((row) => {
        const difference = row.targetAmount - row.actualAmount;
        const tableRow = document.createElement("tr");
        tableRow.className = difference >= 0 ? "needs-buy" : "needs-sell";
        tableRow.style.setProperty("--row-color", row.color);
        tableRow.innerHTML = `
          <td><span class="rebalance-asset"><span></span>${row.path}</span></td>
          <td>${formatMoney(row.actualAmount)}</td>
          <td>${formatMoney(row.targetAmount)}</td>
          <td><strong>${difference >= 0 ? "+" : ""}${formatMoney(difference)}</strong></td>
        `;
        els.rebalanceTableBody.appendChild(tableRow);
      });

    actualPositions
      .filter((position) => !position.planId || !planIds.has(position.planId))
      .forEach((position) => {
        const tableRow = document.createElement("tr");
        tableRow.className = "unmatched-row";
        tableRow.innerHTML = `
          <td>${position.name}</td>
          <td>${formatMoney(position.amount)}</td>
          <td>Sin objetivo</td>
          <td><strong>Vincular</strong></td>
        `;
        els.rebalanceTableBody.appendChild(tableRow);
      });
  }

  function renderRows() {
    const group = getSelectedGroup();
    els.allocationList.innerHTML = "";

    group.items.forEach((item, index) => {
      const row = els.template.content.firstElementChild.cloneNode(true);
      const swatch = row.querySelector(".swatch");
      const colorField = row.querySelector(".color-field");
      const nameField = row.querySelector(".name-field");
      const percentField = row.querySelector(".percent-field input");
      const drillButton = row.querySelector(".drill-button");
      const deleteButton = row.querySelector(".delete-button");

      swatch.style.background = item.color;
      colorField.value = item.color;
      colorField.addEventListener("input", () => {
        item.color = colorField.value;
        swatch.style.background = item.color;
        savePortfolio();
        renderTreemap();
        renderBreakdown();
        renderActualPositions();
      });

      nameField.value = item.name;
      nameField.addEventListener("input", () => {
        item.name = nameField.value || `Grupo ${index + 1}`;
        savePortfolio();
        renderTreemap();
        renderBreadcrumbs();
        renderBreakdown();
        renderActualPositions();
      });

      percentField.value = item.percent;
      percentField.addEventListener("input", () => {
        item.percent = clampPercent(percentField.value);
        savePortfolio();
        renderTreemap();
        renderMetrics(group);
        renderBreakdown();
        renderActualPositions();
      });

      drillButton.addEventListener("click", () => {
        selectedPath.push(item.id);
        render();
      });

      deleteButton.addEventListener("click", () => {
        group.items = group.items.filter((candidate) => candidate.id !== item.id);
        saveAndRender();
      });

      els.allocationList.appendChild(row);
    });
  }

  function addItem() {
    const group = getSelectedGroup();
    const name = els.nameInput.value.trim() || `Grupo ${group.items.length + 1}`;
    const used = group.items.reduce((sum, item) => sum + item.percent, 0);
    const typedPercent = els.percentInput.value === "" ? Math.max(0, 100 - used) : clampPercent(els.percentInput.value);

    group.items.push({
      id: makeId(),
      name,
      percent: typedPercent,
      color: palette[group.items.length % palette.length],
      items: []
    });

    els.form.reset();
    saveAndRender();
    els.nameInput.focus();
  }

  function saveAndRender() {
    savePortfolio();
    render();
  }

  function render() {
    const group = getSelectedGroup();
    renderBreadcrumbs();
    renderTreemap();
    renderMetrics(group);
    renderRows();
    renderBreakdown();
    renderActualPositions();
  }

  els.addButton.addEventListener("click", addItem);
  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    addItem();
  });

  els.portfolioValueInput.addEventListener("input", () => {
    portfolio.value = clampMoney(els.portfolioValueInput.value);
    savePortfolio();
    renderBreakdown();
    renderActualPositions();
  });

  els.breakdownSortButtons.forEach((button) => {
    button.addEventListener("click", () => {
      breakdownSort = button.dataset.breakdownSort;
      renderBreakdown();
    });
  });

  els.actualImagesInput.addEventListener("change", () => {
    selectedImageFiles = [...els.actualImagesInput.files];
    els.imagePreviewList.innerHTML = "";
    selectedImageFiles.forEach((file) => {
      const image = document.createElement("img");
      image.alt = file.name;
      image.src = URL.createObjectURL(file);
      image.addEventListener("load", () => URL.revokeObjectURL(image.src), { once: true });
      els.imagePreviewList.appendChild(image);
    });
    els.scanStatus.textContent = selectedImageFiles.length
      ? `${selectedImageFiles.length} foto(s) cargada(s).`
      : "Cargá una captura o foto, leé el texto y revisá los importes antes de usar la tabla.";
  });

  els.scanImagesButton.addEventListener("click", async () => {
    if (selectedImageFiles.length === 0) {
      els.scanStatus.textContent = "Primero cargá una o más fotos.";
      return;
    }

    if (!globalThis.Tesseract) {
      els.scanStatus.textContent = "No se pudo cargar el lector de fotos. Pegá el texto o cargá las posiciones manualmente.";
      return;
    }

    els.scanImagesButton.disabled = true;
    els.scanStatus.textContent = "Leyendo fotos...";

    try {
      const texts = [];
      for (const file of selectedImageFiles) {
        const result = await globalThis.Tesseract.recognize(file, "eng+spa");
        texts.push(result.data.text);
      }
      els.ocrTextInput.value = texts.join("\n");
      els.scanStatus.textContent = "Texto detectado. Revisalo y usá el botón para armar posiciones.";
    } catch {
      els.scanStatus.textContent = "No pude leer esas fotos. Probá pegando el texto o cargando las posiciones a mano.";
    } finally {
      els.scanImagesButton.disabled = false;
    }
  });

  els.parseTextButton.addEventListener("click", () => {
    const parsedPositions = parseActualPositionsFromText(els.ocrTextInput.value);
    if (parsedPositions.length === 0) {
      els.scanStatus.textContent = "No encontré líneas con nombre e importe. Probá con una línea por activo, por ejemplo: FSLR 1200000.";
      return;
    }

    actualPositions = [...actualPositions, ...parsedPositions];
    saveActualPositions();
    renderActualPositions();
    els.scanStatus.textContent = `${parsedPositions.length} posición(es) agregada(s). Revisá los vínculos antes de operar.`;
  });

  els.addActualButton.addEventListener("click", () => {
    actualPositions.push({
      id: makeId(),
      name: "Activo",
      amount: 0,
      planId: ""
    });
    saveActualPositions();
    renderActualPositions();
  });

  els.clearActualButton.addEventListener("click", () => {
    actualPositions = [];
    saveActualPositions();
    renderActualPositions();
    els.scanStatus.textContent = "Posiciones reales borradas.";
  });

  els.exportButton.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(portfolio, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "portafolio-visual.json";
    link.click();
    URL.revokeObjectURL(url);
  });

  els.importInput.addEventListener("change", async () => {
    const [file] = els.importInput.files;
    if (!file) return;

    try {
      const text = await file.text();
      portfolio = sanitizeGroup(JSON.parse(text), "Portafolio");
      selectedPath = [];
      saveAndRender();
    } catch {
      alert("No pude importar ese archivo JSON.");
    } finally {
      els.importInput.value = "";
    }
  });

  els.resetDemoButton.addEventListener("click", () => {
    portfolio = structuredClone(demoPortfolio);
    selectedPath = [];
    saveAndRender();
  });

  render();
})();
