const MODULE_ID = "wizard-investigation-board";
const FLAG_SCOPE = MODULE_ID;
const CARD_WIDTH = 220;
const CARD_HEIGHT = 92;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 2.5;
const DEFAULT_EDGE_COLOR = "#d5c7aa";
const DATA_VERSION = 2;
const STATUS_MAP = {
  unknown: { label: "Nieustalone", icon: "fa-solid fa-circle-question" },
  suspected: { label: "Podejrzenie", icon: "fa-solid fa-magnifying-glass" },
  confirmed: { label: "Potwierdzone", icon: "fa-solid fa-circle-check" },
  false: { label: "Fałszywy trop", icon: "fa-solid fa-circle-xmark" },
  resolved: { label: "Rozwiązane", icon: "fa-solid fa-flag-checkered" }
};
const RELATION_MAP = { fact: "Fakt", suspicion: "Podejrzenie", false: "Fałszywa teoria" };
const LINE_STYLE_MAP = { solid: "Ciągła", dashed: "Kreskowana", dotted: "Kropkowana" };
const LINE_SHAPE_MAP = { straight: "Prosta", curved: "Zakrzywiona" };

function normalizeBoardData(board) {
  const source = board && typeof board === "object" ? board : {};
  const groups = [];
  const groupIds = new Set();
  for (const raw of (Array.isArray(source.groups) ? source.groups : []).slice(0, 250)) {
    const id = typeof raw?.id === "string" && raw.id && !groupIds.has(raw.id) ? raw.id : foundry.utils.randomID();
    groupIds.add(id);
    groups.push({ id, name: String(raw?.name ?? "Grupa").trim().slice(0, 100) || "Grupa", color: /^#[0-9a-f]{6}$/i.test(String(raw?.color ?? "")) ? raw.color : DEFAULT_EDGE_COLOR });
  }
  const nodes = [];
  const nodeIds = new Set();
  const validTypes = new Set(["note", ...Object.values(TYPE_MAP).map(item => item.type)]);
  for (const raw of (Array.isArray(source.nodes) ? source.nodes : []).slice(0, 2000)) {
    const id = typeof raw?.id === "string" && raw.id && !nodeIds.has(raw.id) ? raw.id : foundry.utils.randomID();
    nodeIds.add(id);
    const node = {
      id,
      type: validTypes.has(raw?.type) ? raw.type : "note",
      name: String(raw?.name ?? "Karta").trim().slice(0, 120) || "Karta",
      description: String(raw?.description ?? "").slice(0, 10000),
      x: Number.isFinite(raw?.x) ? Math.max(-100000, Math.min(100000, raw.x)) : 0,
      y: Number.isFinite(raw?.y) ? Math.max(-100000, Math.min(100000, raw.y)) : 0,
      visibility: raw?.visibility === "gm" ? "gm" : "players",
      status: STATUS_MAP[raw?.status] ? raw.status : "unknown",
      eventDate: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(raw?.eventDate ?? "")) ? raw.eventDate : "",
      dateApproximate: raw?.dateApproximate === true,
      authorId: typeof raw?.authorId === "string" ? raw.authorId : null,
      authorName: String(raw?.authorName ?? "").slice(0, 120)
    };
    if (groupIds.has(raw?.groupId)) node.groupId = raw.groupId;
    if (typeof raw?.image === "string" && raw.image) node.image = raw.image;
    if (typeof raw?.documentUuid === "string" && raw.documentUuid) node.documentUuid = raw.documentUuid;
    nodes.push(node);
  }
  const edges = [];
  const edgeIds = new Set();
  for (const raw of (Array.isArray(source.edges) ? source.edges : []).slice(0, 4000)) {
    if (!nodeIds.has(raw?.from) || !nodeIds.has(raw?.to) || raw.from === raw.to) continue;
    const id = typeof raw?.id === "string" && raw.id && !edgeIds.has(raw.id) ? raw.id : foundry.utils.randomID();
    edgeIds.add(id);
    edges.push({
      id, from: raw.from, to: raw.to, label: String(raw?.label ?? "").slice(0, 240),
      color: /^#[0-9a-f]{6}$/i.test(String(raw?.color ?? "")) ? raw.color : DEFAULT_EDGE_COLOR,
      relationType: RELATION_MAP[raw?.relationType] ? raw.relationType : "fact",
      shape: LINE_SHAPE_MAP[raw?.shape] ? raw.shape : "straight",
      lineStyle: LINE_STYLE_MAP[raw?.lineStyle] ? raw.lineStyle : (raw?.relationType === "suspicion" ? "dashed" : raw?.relationType === "false" ? "dotted" : "solid"),
      width: [2, 3, 5, 7].includes(Number(raw?.width)) ? Number(raw.width) : 3,
      directed: raw?.directed === true,
      visibility: raw?.visibility === "gm" ? "gm" : "players"
    });
  }
  return { version: DATA_VERSION, revision: Number.isSafeInteger(source.revision) && source.revision >= 0 ? source.revision : 0, nodes, edges, groups, view: { panX: Number.isFinite(source.view?.panX) ? source.view.panX : 60, panY: Number.isFinite(source.view?.panY) ? source.view.panY : 60, zoom: Number.isFinite(source.view?.zoom) ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, source.view.zoom)) : 1 } };
}

function clipToCard(cx, cy, targetX, targetY) {
  const dx = targetX - cx;
  const dy = targetY - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const scale = Math.min((CARD_WIDTH / 2) / Math.max(Math.abs(dx), 0.001), (CARD_HEIGHT / 2) / Math.max(Math.abs(dy), 0.001));
  return { x: cx + dx * scale, y: cy + dy * scale };
}

function documentImage(document) {
  if (!document) return null;
  if (typeof document.img === "string" && document.img) return document.img;
  if (typeof document.thumb === "string" && document.thumb) return document.thumb;
  if (typeof document.background?.src === "string" && document.background.src) return document.background.src;
  const imagePage = document.pages?.find?.(page => page.type === "image" && typeof page.src === "string" && page.src);
  return imagePage?.src ?? null;
}

const TYPE_MAP = {
  Actor: { type: "npc", label: "NPC", icon: "fa-solid fa-user" },
  JournalEntry: { type: "document", label: "Dokument", icon: "fa-solid fa-book-open" },
  Item: { type: "item", label: "Przedmiot", icon: "fa-solid fa-gem" },
  Scene: { type: "location", label: "Miejsce", icon: "fa-solid fa-map-location-dot" }
};

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;

class InvestigationBoard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "wizard-investigation-board",
    classes: ["wizard-investigation-board"],
    window: { title: "Wizard Investigation Board", icon: "fa-solid fa-diagram-project", resizable: true },
    position: { width: 1050, height: 720 },
    actions: {
      "new-case": this._actionNewCase,
      "case-settings": this._actionCaseSettings,
      "undo": this._actionUndo,
      "toggle-images": this._actionToggleImages,
      "auto-layout": this._actionAutoLayout,
      "clear-selection": this._actionClearSelection,
      "create-group": this._actionCreateGroup,
      "bulk-edit": this._actionBulkEdit,
      "edit-group": this._actionEditGroup,
      "add-document": this._actionAddDocument,
      "new-note": this._actionNewNote,
      "connection-mode": this._actionConnectionMode,
      "connect-node": this._actionConnectNode,
      "open-document": this._actionOpenDocument,
      "edit-node": this._actionEditNode,
      "delete-node": this._actionDeleteNode,
      "reveal-node": this._actionRevealNode,
      "search": this._actionSearch,
      "export-case": this._actionExportCase,
      "import-case": this._actionImportCase,
      "delete-case": this._actionDeleteCase,
      "player-view": this._actionPlayerView,
      "timeline-view": this._actionTimelineView,
      "focus-timeline-node": this._actionFocusTimelineNode,
      "reset-zoom": this._actionResetZoom,
      "validate-case": this._actionValidateCase,
      "restore-backup": this._actionRestoreBackup,
      "fit": this._actionFit
    }
  };

  static PARTS = {
    board: { template: `modules/${MODULE_ID}/templates/board.hbs` }
  };

  constructor(options = {}) {
    super(options);
    this.activeCaseId = null;
    this.playerView = !game.user.isGM;
    this.connecting = false;
    this.connectFromId = null;
    this.highlightedNodeId = null;
    this.remoteCases = [];
    this.historyByCase = new Map();
    this.selectedNodeIds = new Set();
    this.filters = { type: "all", status: "all", group: "all" };
    this.timelineView = false;
    this.timelineRange = { from: "", to: "" };
  }

  static _actionNewCase() {
    return this._createCase();
  }

  static _actionCaseSettings() {
    return this._caseSettings();
  }

  static _actionUndo() {
    return this._undo();
  }

  static async _actionToggleImages() {
    await game.settings.set(MODULE_ID, "showImages", !game.settings.get(MODULE_ID, "showImages"));
    return this.render({ force: true });
  }

  static _actionAutoLayout() {
    return this._autoLayout();
  }

  static _actionClearSelection() {
    this.selectedNodeIds.clear();
    return this.render({ force: true });
  }

  static _actionCreateGroup() {
    return this._createGroup();
  }

  static _actionBulkEdit() {
    return this._bulkEdit();
  }

  static _actionEditGroup(event, target) {
    return this._editGroup(target.closest("[data-group-id]")?.dataset.groupId);
  }

  static _actionDeleteCase() {
    return this._deleteCase();
  }

  static _actionAddDocument() {
    return this._chooseDocument();
  }

  static _actionNewNote() {
    return this._createNote();
  }

  static _actionConnectionMode() {
    this.connecting = !this.connecting;
    this.connectFromId = null;
    return this.render({ force: true });
  }

  static _actionConnectNode(event, target) {
    return this._connectNode(target.closest("[data-node-id]")?.dataset.nodeId);
  }

  static _actionOpenDocument(event, target) {
    return this._openNodeDocument(target.closest("[data-node-id]")?.dataset.nodeId);
  }

  static _actionEditNode(event, target) {
    return this._editNode(target.closest("[data-node-id]")?.dataset.nodeId);
  }

  static _actionDeleteNode(event, target) {
    return this._deleteNode(target.closest("[data-node-id]")?.dataset.nodeId);
  }

  static _actionRevealNode(event, target) {
    return this._revealNode(target.closest("[data-node-id]")?.dataset.nodeId);
  }

  static _actionSearch() {
    return this._searchCard();
  }

  static _actionExportCase() {
    return this._exportCase();
  }

  static _actionImportCase() {
    return this._importCase();
  }

  static _actionPlayerView() {
    return this._togglePlayerView();
  }

  static _actionTimelineView() {
    this.timelineView = !this.timelineView;
    return this.render({ force: true });
  }

  static _actionFocusTimelineNode(event, target) {
    return this._focusTimelineNode(target.closest("[data-node-id]")?.dataset.nodeId);
  }

  static _actionResetZoom() {
    return this._resetZoom();
  }

  static _actionValidateCase() {
    return this._validateActiveCase();
  }

  static _actionRestoreBackup() {
    return this._restoreMigrationBackup();
  }

  static _actionFit() {
    return this._fitVisible();
  }

  get activeCase() {
    if (!game.user.isGM) return this.remoteCases.find(item => item.id === this.activeCaseId) ?? null;
    const journal = this.activeCaseId ? game.journal.get(this.activeCaseId) : null;
    if (journal?.getFlag(FLAG_SCOPE, "isCase")) return journal;
    return collectPlayerCases().find(item => item.id === this.activeCaseId) ?? null;
  }

  get cases() {
    if (!game.user.isGM) return [...this.remoteCases].sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
    return [
      ...game.journal.filter(journal => journal.getFlag(FLAG_SCOPE, "isCase") === true),
      ...collectPlayerCases()
    ].sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
  }

  get canEditActiveCase() {
    return game.user.isGM || this.activeCase?.createdBy === game.user.id || this.activeCase?.editorIds?.includes(game.user.id);
  }

  _boardData(journal = this.activeCase) {
    const data = journal?.isPlayerCase ? journal.board : (game.user.isGM ? journal?.getFlag(FLAG_SCOPE, "board") : journal?.board);
    return {
      version: DATA_VERSION,
      revision: Number.isSafeInteger(data?.revision) && data.revision >= 0 ? data.revision : 0,
      nodes: Array.isArray(data?.nodes) ? foundry.utils.deepClone(data.nodes) : [],
      edges: Array.isArray(data?.edges) ? foundry.utils.deepClone(data.edges) : [],
      groups: Array.isArray(data?.groups) ? foundry.utils.deepClone(data.groups) : [],
      view: {
        panX: Number.isFinite(data?.view?.panX) ? data.view.panX : 60,
        panY: Number.isFinite(data?.view?.panY) ? data.view.panY : 60,
        zoom: Number.isFinite(data?.view?.zoom) ? data.view.zoom : 1
      }
    };
  }

  async receivePublicCases(cases) {
    if (game.user.isGM || !Array.isArray(cases)) return;
    this.remoteCases = foundry.utils.deepClone(cases);
    if (!this.remoteCases.some(item => item.id === this.activeCaseId)) this.activeCaseId = this.remoteCases[0]?.id ?? null;
    if (this.rendered) await this.render({ force: true });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    if (!this.activeCase && this.cases.length) this.activeCaseId = this.cases[0].id;
    const board = this._boardData();
    const visibleNodes = board.nodes.filter(node => {
      if (this.playerView && node.visibility === "gm") return false;
      if (this.filters.type !== "all" && node.type !== this.filters.type) return false;
      if (this.filters.group !== "all" && (node.groupId ?? "none") !== this.filters.group) return false;
      const status = STATUS_MAP[node.status] ? node.status : "unknown";
      return this.filters.status === "all" || status === this.filters.status;
    });
    const visibleIds = new Set(visibleNodes.map(node => node.id));
    const nodeById = new Map(visibleNodes.map(node => [node.id, node]));
    const nodes = visibleNodes.map(node => {
      const meta = Object.values(TYPE_MAP).find(item => item.type === node.type) ?? { label: node.type ?? "Karta", icon: "fa-solid fa-note-sticky" };
      const status = STATUS_MAP[node.status] ? node.status : "unknown";
      let image = typeof node.image === "string" ? node.image : null;
      if (!image && node.documentUuid) image = documentImage(foundry.utils.fromUuidSync(node.documentUuid));
      return {
        ...node,
        typeLabel: meta.label,
        icon: meta.icon,
        isGMOnly: node.visibility === "gm",
        hasDocument: Boolean(node.documentUuid),
        selectedForConnection: node.id === this.connectFromId,
        status,
        statusLabel: STATUS_MAP[status].label,
        statusIcon: STATUS_MAP[status].icon,
        highlighted: node.id === this.highlightedNodeId,
        image,
        showImage: Boolean(image && game.settings.get(MODULE_ID, "showImages")),
        selected: this.selectedNodeIds.has(node.id)
      };
    });
    const timelineNodes = visibleNodes
      .filter(node => typeof node.eventDate === "string" && node.eventDate && (!this.timelineRange.from || node.eventDate.slice(0, 10) >= this.timelineRange.from) && (!this.timelineRange.to || node.eventDate.slice(0, 10) <= this.timelineRange.to))
      .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
      .map(node => {
        const status = STATUS_MAP[node.status] ? node.status : "unknown";
        const parsed = new Date(node.eventDate);
        return {
          ...node,
          statusLabel: STATUS_MAP[status].label,
          dateLabel: Number.isNaN(parsed.getTime()) ? node.eventDate : new Intl.DateTimeFormat(game.i18n.lang, { dateStyle: "medium", timeStyle: "short" }).format(parsed),
          approximate: node.dateApproximate === true
        };
      });
    const visibleEdges = board.edges.filter(edge => visibleIds.has(edge.from) && visibleIds.has(edge.to) && (!this.playerView || edge.visibility !== "gm"));
    const pairGroups = new Map();
    for (const edge of visibleEdges) {
      const key = [edge.from, edge.to].sort().join("|");
      const list = pairGroups.get(key) ?? [];
      list.push(edge.id);
      pairGroups.set(key, list);
    }
    const edges = visibleEdges.map(edge => {
        const from = nodeById.get(edge.from);
        const to = nodeById.get(edge.to);
        const fromCenter = { x: from.x + CARD_WIDTH / 2, y: from.y + CARD_HEIGHT / 2 };
        const toCenter = { x: to.x + CARD_WIDTH / 2, y: to.y + CARD_HEIGHT / 2 };
        const dx = toCenter.x - fromCenter.x;
        const dy = toCenter.y - fromCenter.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const pair = pairGroups.get([edge.from, edge.to].sort().join("|"));
        const pairIndex = pair.indexOf(edge.id);
        const pairDirection = String(edge.from).localeCompare(String(edge.to)) <= 0 ? 1 : -1;
        const parallelOffset = (pairIndex - (pair.length - 1) / 2) * 42 * pairDirection;
        const shape = LINE_SHAPE_MAP[edge.shape] ? edge.shape : "straight";
        const useCurve = shape === "curved" || pair.length > 1;
        const curveOffset = parallelOffset || (shape === "curved" ? 58 : 0);
        const control = { x: (fromCenter.x + toCenter.x) / 2 - (dy / distance) * curveOffset, y: (fromCenter.y + toCenter.y) / 2 + (dx / distance) * curveOffset };
        const start = clipToCard(fromCenter.x, fromCenter.y, useCurve ? control.x : toCenter.x, useCurve ? control.y : toCenter.y);
        const end = clipToCard(toCenter.x, toCenter.y, useCurve ? control.x : fromCenter.x, useCurve ? control.y : fromCenter.y);
        const path = useCurve ? `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}` : `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
        const labelX = useCurve ? 0.25 * start.x + 0.5 * control.x + 0.25 * end.x : (start.x + end.x) / 2;
        const labelY = useCurve ? 0.25 * start.y + 0.5 * control.y + 0.25 * end.y : (start.y + end.y) / 2;
        const legacyStyle = edge.relationType === "suspicion" ? "dashed" : edge.relationType === "false" ? "dotted" : "solid";
        return {
          ...edge,
          color: this._validColor(edge.color),
          relationType: RELATION_MAP[edge.relationType] ? edge.relationType : "fact",
          lineStyle: LINE_STYLE_MAP[edge.lineStyle] ? edge.lineStyle : legacyStyle,
          width: [2, 3, 5, 7].includes(Number(edge.width)) ? Number(edge.width) : 3,
          directed: edge.directed === true,
          path,
          labelX,
          labelY: labelY - 7
        };
      });
    const groups = board.groups.map(group => {
      const members = visibleNodes.filter(node => node.groupId === group.id);
      if (!members.length) return { ...group, visible: false };
      const minX = Math.min(...members.map(node => node.x)) - 28;
      const minY = Math.min(...members.map(node => node.y)) - 42;
      const maxX = Math.max(...members.map(node => node.x + CARD_WIDTH)) + 28;
      const maxY = Math.max(...members.map(node => node.y + CARD_HEIGHT)) + 28;
      return { ...group, visible: true, x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    });
    return {
      ...context,
      isGM: game.user.isGM,
      moduleVersion: game.modules.get(MODULE_ID)?.version ?? "?",
      canEditCase: this.canEditActiveCase,
      canConfigureCase: game.user.isGM && !this.activeCase?.isPlayerCase,
      hasMigrationBackup: game.user.isGM && !this.activeCase?.isPlayerCase && Boolean(this.activeCase?.getFlag?.(FLAG_SCOPE, "migrationBackup")?.board),
      canUndo: this.canEditActiveCase && (this.historyByCase.get(this.activeCaseId)?.length ?? 0) > 0,
      showImages: game.settings.get(MODULE_ID, "showImages"),
      selectedCount: this.selectedNodeIds.size,
      timelineView: this.timelineView,
      timelineFrom: this.timelineRange.from,
      timelineTo: this.timelineRange.to,
      timelineNodes,
      hasTimelineNodes: timelineNodes.length > 0,
      groups,
      cases: this.cases.map(journal => ({ id: journal.id, name: journal.name, selected: journal.id === this.activeCaseId })),
      hasCase: Boolean(this.activeCase),
      hasNodes: nodes.length > 0,
      nodeCount: nodes.length,
      playerView: this.playerView,
      connecting: this.connecting,
      nodes,
      edges,
      view: board.view
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    root.querySelector('[data-role="case-select"]')?.addEventListener("change", event => this._selectCase(event));
    const typeFilter = root.querySelector('[data-role="filter-type"]');
    const statusFilter = root.querySelector('[data-role="filter-status"]');
    const groupFilter = root.querySelector('[data-role="filter-group"]');
    const timelineFrom = root.querySelector('[data-role="timeline-from"]');
    const timelineTo = root.querySelector('[data-role="timeline-to"]');
    if (typeFilter) {
      typeFilter.value = this.filters.type;
      typeFilter.addEventListener("change", event => { this.filters.type = event.currentTarget.value; this.render({ force: true }); });
    }
    if (statusFilter) {
      statusFilter.value = this.filters.status;
      statusFilter.addEventListener("change", event => { this.filters.status = event.currentTarget.value; this.render({ force: true }); });
    }
    if (groupFilter) {
      groupFilter.value = this.filters.group;
      groupFilter.addEventListener("change", event => { this.filters.group = event.currentTarget.value; this.render({ force: true }); });
    }
    if (timelineFrom) timelineFrom.addEventListener("change", event => { this.timelineRange.from = event.currentTarget.value; this.render({ force: true }); });
    if (timelineTo) timelineTo.addEventListener("change", event => { this.timelineRange.to = event.currentTarget.value; this.render({ force: true }); });
    root.querySelector('[data-role="search-input"]')?.addEventListener("keydown", event => {
      if (event.key === "Enter") { event.preventDefault(); this._searchCard(); }
    });

    const board = root.querySelector('[data-role="board"]');
    if (!board || !this.activeCase) return;
    if (this.timelineView) return;
    this._renderMinimap(board);
    board.addEventListener("dragover", event => { event.preventDefault(); event.dataTransfer.dropEffect = "copy"; });
    board.addEventListener("drop", event => this._onDrop(event));
    board.addEventListener("wheel", event => this._onWheel(event), { passive: false });
    board.addEventListener("pointerdown", event => this._onBoardPointerDown(event));
    for (const card of board.querySelectorAll(".wib-card")) {
      card.addEventListener("pointerdown", event => this._onCardPointerDown(event, card));
      card.addEventListener("dblclick", event => this._openCardDocument(event, card));
      if (game.user.isGM) card.addEventListener("contextmenu", event => {
          event.preventDefault();
          this._duplicateNode(card.dataset.nodeId);
        });
    }
    for (const edge of this.canEditActiveCase ? board.querySelectorAll("[data-edge-id]") : []) {
      edge.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        this._editEdge(edge.dataset.edgeId);
      });
    }
  }

  async _selectCase(event) {
    this.activeCaseId = event.currentTarget.value || null;
    this.selectedNodeIds.clear();
    await this.render({ force: true });
  }

  async _createCase() {
    try {
      const values = await DialogV2.input({
        window: { title: "Nowa sprawa" },
        content: '<div class="form-group"><label>Nazwa sprawy</label><input name="name" type="text" required autofocus autocomplete="off" maxlength="120"></div>' +
          (game.user.isGM ? '<div class="form-group"><label>Widoczność sprawy</label><select name="caseVisibility"><option value="players">Dla graczy</option><option value="gm">Tylko MG</option></select></div>' : '<p>Twoja sprawa będzie widoczna dla wszystkich graczy.</p>'),
        ok: { label: "Utwórz", icon: "fa-solid fa-plus" },
        rejectClose: false,
        modal: true
      });
      const name = String(values?.name ?? "").trim();
      if (!values) return;
      if (!name) return ui.notifications.warn("Podaj nazwę sprawy.");
      if (!game.user.isGM) {
        const cases = foundry.utils.deepClone(game.user.getFlag(FLAG_SCOPE, "playerCases") ?? []);
        const playerCase = {
          id: `player-${game.user.id}-${foundry.utils.randomID()}`,
          name,
          createdBy: game.user.id,
          isPlayerCase: true,
          board: { version: DATA_VERSION, revision: 0, nodes: [], edges: [], groups: [], view: { panX: 60, panY: 60, zoom: 1 } }
        };
        cases.push(playerCase);
        await game.user.setFlag(FLAG_SCOPE, "playerCases", cases);
        this.activeCaseId = playerCase.id;
        refreshRemoteCases();
        ui.notifications.info(`Utworzono Twoją sprawę „${name}”.`);
        return;
      }
      const JournalEntryClass = CONFIG.JournalEntry.documentClass;
      const journal = await JournalEntryClass.create({
        name,
        ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE },
        flags: {
          [FLAG_SCOPE]: {
            isCase: true,
            caseVisibility: values.caseVisibility === "gm" ? "gm" : "players",
            createdBy: game.user.id,
            board: { version: DATA_VERSION, revision: 0, nodes: [], edges: [], groups: [], view: { panX: 60, panY: 60, zoom: 1 } }
          }
        }
      });
      if (!journal) throw new Error("Foundry nie zwróciło utworzonego JournalEntry.");
      this.activeCaseId = journal.id;
      ui.notifications.info(`Utworzono sprawę „${journal.name}”.`);
      await this.render({ force: true });
    } catch (error) {
      this._notifyError("Nie udało się utworzyć sprawy.", error);
    }
  }

  async _caseSettings() {
    const journal = this.activeCase;
    if (!journal) return ui.notifications.warn("Najpierw wybierz sprawę.");
    if (!game.user.isGM) return ui.notifications.warn("Tylko MG może zmieniać widoczność sprawy.");
    const current = journal.getFlag(FLAG_SCOPE, "caseVisibility") === "gm" ? "gm" : "players";
    const viewerIds = journal.getFlag(FLAG_SCOPE, "viewerIds") ?? [];
    const editorIds = journal.getFlag(FLAG_SCOPE, "editorIds") ?? [];
    const accessRestricted = journal.getFlag(FLAG_SCOPE, "accessRestricted") === true;
    const players = game.users.filter(user => !user.isGM);
    const accessFields = players.map(user => `<div class="form-group wib-access-row"><span>${foundry.utils.escapeHTML(user.name)}</span><label><input type="checkbox" name="viewer_${user.id}" ${!accessRestricted || viewerIds.includes(user.id) ? "checked" : ""}> widzi</label><label><input type="checkbox" name="editor_${user.id}" ${editorIds.includes(user.id) ? "checked" : ""}> edytuje</label></div>`).join("");
    try {
      const values = await DialogV2.input({
        window: { title: "Ustawienia sprawy" },
        content: `<div class="form-group"><label>Widoczność sprawy</label><select name="caseVisibility"><option value="players" ${current === "players" ? "selected" : ""}>Dla graczy</option><option value="gm" ${current === "gm" ? "selected" : ""}>Tylko MG</option></select></div><hr><p><strong>Dostęp graczy</strong></p><p><small>Jeśli zaznaczeni są wszyscy gracze, sprawa pozostaje publiczna. Prawo edycji automatycznie daje również podgląd.</small></p>${accessFields}`,
        ok: { label: "Zapisz", icon: "fa-solid fa-floppy-disk" },
        rejectClose: false,
        modal: true
      });
      if (!values) return;
      const selectedViewers = players.filter(user => values[`viewer_${user.id}`] === true || values[`viewer_${user.id}`] === "true" || values[`viewer_${user.id}`] === "on").map(user => user.id);
      const selectedEditors = players.filter(user => values[`editor_${user.id}`] === true || values[`editor_${user.id}`] === "true" || values[`editor_${user.id}`] === "on").map(user => user.id);
      const effectiveViewers = [...new Set([...selectedViewers, ...selectedEditors])];
      await journal.update({ [`flags.${FLAG_SCOPE}.caseVisibility`]: values.caseVisibility === "gm" ? "gm" : "players", [`flags.${FLAG_SCOPE}.accessRestricted`]: effectiveViewers.length !== players.length, [`flags.${FLAG_SCOPE}.viewerIds`]: effectiveViewers, [`flags.${FLAG_SCOPE}.editorIds`]: selectedEditors });
      ui.notifications.info("Zmieniono widoczność i uprawnienia sprawy.");
      await this.render({ force: true });
    } catch (error) {
      this._notifyError("Nie udało się zmienić widoczności sprawy.", error);
    }
  }

  async _deleteCase() {
    const journal = this.activeCase;
    if (!journal) return ui.notifications.warn("Najpierw wybierz sprawę.");
    if (!game.user.isGM) return ui.notifications.warn("Tylko MG może usuwać sprawy.");
    const confirmed = await DialogV2.confirm({
      window: { title: "Usuń sprawę" },
      content: `<p>Czy na pewno usunąć sprawę <strong>${foundry.utils.escapeHTML(journal.name)}</strong>? Tej operacji nie można cofnąć.</p>`,
      yes: { label: "Usuń", icon: "fa-solid fa-trash" },
      no: { label: "Anuluj" },
      rejectClose: false,
      modal: true
    });
    if (!confirmed) return;
    try {
      if (journal.isPlayerCase) {
        const owner = game.users.get(journal.createdBy);
        const cases = foundry.utils.deepClone(owner?.getFlag(FLAG_SCOPE, "playerCases") ?? []).filter(item => item.id !== journal.id);
        if (!owner) throw new Error("Nie znaleziono właściciela sprawy gracza.");
        await owner.setFlag(FLAG_SCOPE, "playerCases", cases);
      } else await journal.delete();
      this.activeCaseId = this.cases[0]?.id ?? null;
      ui.notifications.info("Sprawa została usunięta.");
      await this.render({ force: true });
    } catch (error) {
      this._notifyError("Nie udało się usunąć sprawy.", error);
    }
  }

  async _chooseDocument() {
    if (!this.activeCase) return ui.notifications.warn("Najpierw wybierz sprawę.");
    if (!game.user.isGM) return ui.notifications.warn("Tylko MG może dodawać dokumenty do sprawy.");
    const groups = [
      ["Actor", "Actorzy", game.actors],
      ["JournalEntry", "Journale", game.journal.filter(j => !j.getFlag(FLAG_SCOPE, "isCase"))],
      ["Item", "Przedmioty", game.items],
      ["Scene", "Sceny", game.scenes]
    ];
    const optionGroups = groups.map(([type, label, collection]) => {
      const documents = Array.from(collection ?? []).sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));
      if (!documents.length) return "";
      const options = documents.map(document => `<option value="${foundry.utils.escapeHTML(document.uuid)}">${foundry.utils.escapeHTML(document.name)}</option>`).join("");
      return `<optgroup label="${type}: ${label}">${options}</optgroup>`;
    }).join("");
    if (!optionGroups) return ui.notifications.warn("W świecie nie ma Actorów, Journali, Itemów ani Scen do dodania.");
    try {
      const values = await DialogV2.input({
        window: { title: "Dodaj dokument do sprawy" },
        content: `<div class="form-group"><label>Dokument</label><select name="uuid" autofocus>${optionGroups}</select></div>
          <div class="form-group"><label>Status</label><select name="status"><option value="unknown">Nieustalone</option><option value="suspected">Podejrzenie</option><option value="confirmed">Potwierdzone</option><option value="false">Fałszywy trop</option><option value="resolved">Rozwiązane</option></select></div>
          <div class="form-group"><label>Widoczność</label><select name="visibility"><option value="players">Gracze</option><option value="gm">Tylko MG</option></select></div>`,
        ok: { label: "Dodaj", icon: "fa-solid fa-plus" },
        rejectClose: false,
        modal: true
      });
      if (!values) return;
      const document = await foundry.utils.fromUuid(String(values.uuid ?? ""));
      if (!document) throw new Error("Nie znaleziono wybranego dokumentu.");
      const boardElement = this.element.querySelector('[data-role="board"]');
      const data = this._boardData();
      const viewportWidth = Math.max(boardElement.clientWidth, 640);
      const viewportHeight = Math.max(boardElement.clientHeight, 420);
      const x = Math.round((viewportWidth / 2 - data.view.panX) / data.view.zoom - CARD_WIDTH / 2);
      const y = Math.round((viewportHeight / 2 - data.view.panY) / data.view.zoom - CARD_HEIGHT / 2);
      await this._addDocumentCard(document, x, y, values.visibility === "players" ? "players" : "gm", values.status);
    } catch (error) {
      this._notifyError("Nie udało się dodać dokumentu.", error);
    }
  }

  async _createNote() {
    if (!this.activeCase) return ui.notifications.warn("Najpierw wybierz sprawę.");
    if (!this.canEditActiveCase) return ui.notifications.warn("Nie możesz edytować tej sprawy.");
    try {
      const values = await DialogV2.input({
        window: { title: "Nowa notatka" },
        content: '<div class="form-group"><label>Tytuł</label><input name="name" type="text" required autofocus autocomplete="off"></div>' +
          '<div class="form-group"><label>Treść</label><textarea name="description" rows="4"></textarea></div>' +
          '<div class="form-group"><label>Data i godzina wydarzenia (opcjonalnie)</label><input name="eventDate" type="datetime-local"></div>' +
          '<div class="form-group"><label><input name="dateApproximate" type="checkbox"> Data przybliżona</label></div>' +
          '<div class="form-group"><label>Status</label><select name="status"><option value="unknown">Nieustalone</option><option value="suspected">Podejrzenie</option><option value="confirmed">Potwierdzone</option><option value="false">Fałszywy trop</option><option value="resolved">Rozwiązane</option></select></div>' +
          '<div class="form-group"><label>Widoczność</label><select name="visibility"><option value="players">Gracze</option><option value="gm">Tylko MG</option></select></div>',
        ok: { label: "Dodaj notatkę", icon: "fa-solid fa-note-sticky" },
        rejectClose: false,
        modal: true
      });
      if (!values) return;
      const name = String(values.name ?? "").trim();
      if (!name) return ui.notifications.warn("Podaj tytuł notatki.");
      const boardElement = this.element.querySelector('[data-role="board"]');
      const data = this._boardData();
      const viewportWidth = Math.max(boardElement.clientWidth, 640);
      const viewportHeight = Math.max(boardElement.clientHeight, 420);
      data.nodes.push({
        id: foundry.utils.randomID(),
        type: "note",
        name,
        description: String(values.description ?? "").trim(),
        authorId: game.user.id,
        authorName: game.user.name,
        eventDate: String(values.eventDate ?? "").trim(),
        dateApproximate: values.dateApproximate === true || values.dateApproximate === "true" || values.dateApproximate === "on",
        status: STATUS_MAP[values.status] ? values.status : "unknown",
        x: Math.round((viewportWidth / 2 - data.view.panX) / data.view.zoom - CARD_WIDTH / 2),
        y: Math.round((viewportHeight / 2 - data.view.panY) / data.view.zoom - CARD_HEIGHT / 2),
        visibility: !game.user.isGM || values.visibility === "players" ? "players" : "gm"
      });
      await this._saveBoard(data);
      ui.notifications.info(`Dodano notatkę „${name}”.`);
      await this.render({ force: true });
    } catch (error) {
      this._notifyError("Nie udało się dodać notatki.", error);
    }
  }

  async _connectNode(nodeId) {
    if (!this.activeCase) return ui.notifications.warn("Najpierw wybierz sprawę.");
    if (!this.connecting) return ui.notifications.info("Najpierw włącz tryb „Połącz karty”.");
    const data = this._boardData();
    const node = data.nodes.find(item => item.id === nodeId);
    if (!node) return ui.notifications.warn("Nie znaleziono wybranej karty.");
    if (!this.connectFromId) {
      this.connectFromId = nodeId;
      ui.notifications.info(`Pierwsza karta: „${node.name}”. Wybierz drugą kartę.`);
      return this.render({ force: true });
    }
    if (this.connectFromId === nodeId) return ui.notifications.warn("Wybierz inną kartę jako koniec połączenia.");
    const from = data.nodes.find(item => item.id === this.connectFromId);
    try {
      const values = await DialogV2.input({
        window: { title: "Połącz karty" },
        content: `<p><strong>${foundry.utils.escapeHTML(from.name)}</strong> → <strong>${foundry.utils.escapeHTML(node.name)}</strong></p>` +
          '<div class="form-group"><label>Opis relacji</label><input name="label" type="text" autofocus autocomplete="off" placeholder="np. podejrzewa, spotkał, prowadzi do"></div>' +
          '<div class="form-group"><label>Typ relacji</label><select name="relationType"><option value="fact">Fakt</option><option value="suspicion">Podejrzenie</option><option value="false">Fałszywa teoria</option></select></div>' +
          `<div class="form-group"><label>Kolor linii</label><input name="color" type="color" value="${DEFAULT_EDGE_COLOR}"></div>` +
          '<div class="form-group"><label>Kształt</label><select name="shape"><option value="straight">Prosta</option><option value="curved">Zakrzywiona</option></select></div>' +
          '<div class="form-group"><label>Styl</label><select name="lineStyle"><option value="solid">Ciągła</option><option value="dashed">Kreskowana</option><option value="dotted">Kropkowana</option></select></div>' +
          '<div class="form-group"><label>Grubość</label><select name="width"><option value="2">Cienka</option><option value="3" selected>Normalna</option><option value="5">Gruba</option><option value="7">Bardzo gruba</option></select></div>' +
          '<div class="form-group"><label><input name="directed" type="checkbox" checked> Pokaż kierunek strzałką</label></div>' +
          '<div class="form-group"><label>Widoczność</label><select name="visibility"><option value="players">Gracze</option><option value="gm">Tylko MG</option></select></div>',
        ok: { label: "Połącz", icon: "fa-solid fa-link" },
        rejectClose: false,
        modal: true
      });
      if (!values) return;
      data.edges.push({
        id: foundry.utils.randomID(),
        from: from.id,
        to: node.id,
        label: String(values.label ?? "").trim(),
        relationType: RELATION_MAP[values.relationType] ? values.relationType : "fact",
        color: this._validColor(values.color),
        shape: LINE_SHAPE_MAP[values.shape] ? values.shape : "straight",
        lineStyle: LINE_STYLE_MAP[values.lineStyle] ? values.lineStyle : "solid",
        width: [2, 3, 5, 7].includes(Number(values.width)) ? Number(values.width) : 3,
        directed: values.directed === true || values.directed === "true" || values.directed === "on",
        visibility: !game.user.isGM || values.visibility === "players" ? "players" : "gm"
      });
      await this._saveBoard(data);
      this.connectFromId = null;
      this.connecting = false;
      ui.notifications.info("Karty zostały połączone.");
      await this.render({ force: true });
    } catch (error) {
      this._notifyError("Nie udało się połączyć kart.", error);
    }
  }

  async _openNodeDocument(nodeId) {
    const node = this._boardData().nodes.find(item => item.id === nodeId);
    if (!node?.documentUuid) return ui.notifications.warn("Ta karta nie ma powiązanego dokumentu.");
    try {
      const document = await foundry.utils.fromUuid(node.documentUuid);
      if (!document) throw new Error("Dokument nie istnieje lub nie jest dostępny.");
      document.sheet?.render({ force: true });
    } catch (error) {
      this._notifyError("Nie udało się otworzyć dokumentu.", error);
    }
  }

  async _createGroup() {
    if (!this.activeCase || !this.canEditActiveCase) return ui.notifications.warn("Nie możesz zmieniać tej sprawy.");
    const data = this._boardData();
    const selected = data.nodes.filter(node => this.selectedNodeIds.has(node.id));
    if (!selected.length) return ui.notifications.warn("Najpierw zaznacz co najmniej jedną kartę.");
    try {
      const values = await DialogV2.input({
        window: { title: "Nowa grupa kart" },
        content: '<div class="form-group"><label>Nazwa grupy</label><input name="name" type="text" required autofocus maxlength="100"></div><div class="form-group"><label>Kolor obszaru</label><input name="color" type="color" value="#6f5aa8"></div>',
        ok: { label: "Utwórz", icon: "fa-solid fa-layer-group" }, rejectClose: false, modal: true
      });
      if (!values) return;
      const name = String(values.name ?? "").trim();
      if (!name) return ui.notifications.warn("Podaj nazwę grupy.");
      const id = foundry.utils.randomID();
      data.groups.push({ id, name: name.slice(0, 100), color: this._validColor(values.color) });
      for (const node of selected) node.groupId = id;
      await this._saveBoard(data);
      ui.notifications.info(`Utworzono grupę „${name}” dla kart: ${selected.length}.`);
      await this.render({ force: true });
    } catch (error) { this._notifyError("Nie udało się utworzyć grupy.", error); }
  }

  async _bulkEdit() {
    if (!this.activeCase || !this.canEditActiveCase) return ui.notifications.warn("Nie możesz zmieniać tej sprawy.");
    const data = this._boardData();
    const selected = data.nodes.filter(node => this.selectedNodeIds.has(node.id));
    if (!selected.length) return ui.notifications.warn("Najpierw zaznacz karty do zmiany.");
    const groupOptions = data.groups.map(group => `<option value="${group.id}">${foundry.utils.escapeHTML(group.name)}</option>`).join("");
    try {
      const values = await DialogV2.input({
        window: { title: `Operacje zbiorcze (${selected.length})` },
        content: '<div class="form-group"><label>Status</label><select name="status"><option value="keep">Bez zmian</option><option value="unknown">Nieustalone</option><option value="suspected">Podejrzenie</option><option value="confirmed">Potwierdzone</option><option value="false">Fałszywy trop</option><option value="resolved">Rozwiązane</option></select></div>' +
          `<div class="form-group"><label>Widoczność</label><select name="visibility"><option value="keep">Bez zmian</option><option value="players">Gracze</option>${game.user.isGM ? '<option value="gm">Tylko MG</option>' : ""}</select></div>` +
          `<div class="form-group"><label>Grupa</label><select name="groupId"><option value="keep">Bez zmian</option><option value="none">Bez grupy</option>${groupOptions}</select></div>` +
          '<div class="form-group"><label><input name="remove" type="checkbox"> Usuń zaznaczone karty i ich połączenia</label></div>',
        ok: { label: "Zastosuj", icon: "fa-solid fa-check" }, rejectClose: false, modal: true
      });
      if (!values) return;
      const remove = values.remove === true || values.remove === "true" || values.remove === "on";
      if (remove) {
        const confirmed = await DialogV2.confirm({ window: { title: "Usuń zaznaczone karty" }, content: `<p>Czy na pewno usunąć kart: <strong>${selected.length}</strong>? Usunięte zostaną także ich połączenia.</p>`, yes: { label: "Usuń", icon: "fa-solid fa-trash" }, no: { label: "Anuluj" }, rejectClose: false, modal: true });
        if (!confirmed) return;
        const ids = new Set(selected.map(node => node.id));
        data.nodes = data.nodes.filter(node => !ids.has(node.id));
        data.edges = data.edges.filter(edge => !ids.has(edge.from) && !ids.has(edge.to));
        this.selectedNodeIds.clear();
      } else {
        for (const node of selected) {
          if (STATUS_MAP[values.status]) node.status = values.status;
          if (values.visibility !== "keep") node.visibility = !game.user.isGM || values.visibility === "players" ? "players" : "gm";
          if (values.groupId === "none") delete node.groupId;
          else if (data.groups.some(group => group.id === values.groupId)) node.groupId = values.groupId;
        }
      }
      await this._saveBoard(data);
      ui.notifications.info(remove ? "Zaznaczone karty zostały usunięte." : "Zaktualizowano zaznaczone karty.");
      await this.render({ force: true });
    } catch (error) { this._notifyError("Nie udało się wykonać operacji zbiorczej.", error); }
  }

  async _editGroup(groupId) {
    if (!this.activeCase || !this.canEditActiveCase) return ui.notifications.warn("Nie możesz zmieniać tej sprawy.");
    const data = this._boardData();
    const group = data.groups.find(item => item.id === groupId);
    if (!group) return ui.notifications.warn("Nie znaleziono grupy.");
    try {
      const values = await DialogV2.input({
        window: { title: "Edytuj grupę" },
        content: `<div class="form-group"><label>Nazwa</label><input name="name" type="text" value="${foundry.utils.escapeHTML(group.name)}" required autofocus maxlength="100"></div><div class="form-group"><label>Kolor obszaru</label><input name="color" type="color" value="${this._validColor(group.color)}"></div><div class="form-group"><label><input name="remove" type="checkbox"> Usuń grupę (karty pozostaną)</label></div>`,
        ok: { label: "Zastosuj", icon: "fa-solid fa-check" }, rejectClose: false, modal: true
      });
      if (!values) return;
      const remove = values.remove === true || values.remove === "true" || values.remove === "on";
      if (remove) {
        data.groups = data.groups.filter(item => item.id !== groupId);
        for (const node of data.nodes) if (node.groupId === groupId) delete node.groupId;
      } else {
        const name = String(values.name ?? "").trim();
        if (!name) return ui.notifications.warn("Nazwa grupy nie może być pusta.");
        group.name = name.slice(0, 100);
        group.color = this._validColor(values.color);
      }
      await this._saveBoard(data);
      if (this.filters.group === groupId && remove) this.filters.group = "all";
      ui.notifications.info(remove ? "Grupa została usunięta; karty pozostały na planszy." : "Grupa została zaktualizowana.");
      await this.render({ force: true });
    } catch (error) { this._notifyError("Nie udało się zmienić grupy.", error); }
  }

  async _editNode(nodeId) {
    const data = this._boardData();
    const node = data.nodes.find(item => item.id === nodeId);
    if (!node) return ui.notifications.warn("Nie znaleziono karty.");
    try {
      const values = await DialogV2.input({
        window: { title: "Edytuj kartę" },
        content: `<div class="form-group"><label>Nazwa</label><input name="name" type="text" value="${foundry.utils.escapeHTML(node.name)}" required autofocus></div>` +
          `<div class="form-group"><label>Opis / notatka</label><textarea name="description" rows="5">${foundry.utils.escapeHTML(node.description ?? "")}</textarea></div>` +
          `<div class="form-group"><label>Data i godzina wydarzenia (opcjonalnie)</label><input name="eventDate" type="datetime-local" value="${foundry.utils.escapeHTML(node.eventDate ?? "")}"></div>` +
          `<div class="form-group"><label><input name="dateApproximate" type="checkbox" ${node.dateApproximate === true ? "checked" : ""}> Data przybliżona</label></div>` +
          `<div class="form-group"><label>Status</label><select name="status"><option value="unknown" ${!STATUS_MAP[node.status] || node.status === "unknown" ? "selected" : ""}>Nieustalone</option><option value="suspected" ${node.status === "suspected" ? "selected" : ""}>Podejrzenie</option><option value="confirmed" ${node.status === "confirmed" ? "selected" : ""}>Potwierdzone</option><option value="false" ${node.status === "false" ? "selected" : ""}>Fałszywy trop</option><option value="resolved" ${node.status === "resolved" ? "selected" : ""}>Rozwiązane</option></select></div>` +
          `<div class="form-group"><label>Widoczność</label><select name="visibility"><option value="gm" ${node.visibility === "gm" ? "selected" : ""}>Tylko MG</option><option value="players" ${node.visibility === "players" ? "selected" : ""}>Gracze</option></select></div>`,
        ok: { label: "Zapisz", icon: "fa-solid fa-floppy-disk" },
        rejectClose: false,
        modal: true
      });
      if (!values) return;
      const name = String(values.name ?? "").trim();
      if (!name) return ui.notifications.warn("Nazwa karty nie może być pusta.");
      node.name = name;
      node.description = String(values.description ?? "").trim();
      node.eventDate = String(values.eventDate ?? "").trim();
      node.dateApproximate = values.dateApproximate === true || values.dateApproximate === "true" || values.dateApproximate === "on";
      node.status = STATUS_MAP[values.status] ? values.status : "unknown";
      node.visibility = !game.user.isGM || values.visibility === "players" ? "players" : "gm";
      await this._saveBoard(data);
      ui.notifications.info("Karta została zaktualizowana.");
      await this.render({ force: true });
    } catch (error) {
      this._notifyError("Nie udało się zapisać karty.", error);
    }
  }

  async _deleteNode(nodeId) {
    const data = this._boardData();
    const node = data.nodes.find(item => item.id === nodeId);
    if (!node) return ui.notifications.warn("Nie znaleziono karty.");
    const connectedCount = data.edges.filter(edge => edge.from === nodeId || edge.to === nodeId).length;
    const confirmed = await DialogV2.confirm({
      window: { title: "Usuń kartę" },
      content: `<p>Czy usunąć kartę <strong>${foundry.utils.escapeHTML(node.name)}</strong>?</p>${connectedCount ? `<p>Zostanie również usuniętych połączeń: <strong>${connectedCount}</strong>.</p>` : ""}`,
      yes: { label: "Usuń", icon: "fa-solid fa-trash" },
      no: { label: "Anuluj" },
      rejectClose: false,
      modal: true
    });
    if (!confirmed) return;
    try {
      data.nodes = data.nodes.filter(item => item.id !== nodeId);
      data.edges = data.edges.filter(edge => edge.from !== nodeId && edge.to !== nodeId);
      if (this.connectFromId === nodeId) this.connectFromId = null;
      await this._saveBoard(data);
      ui.notifications.info("Karta została usunięta.");
      await this.render({ force: true });
    } catch (error) {
      this._notifyError("Nie udało się usunąć karty.", error);
    }
  }

  async _revealNode(nodeId) {
    const data = this._boardData();
    const node = data.nodes.find(item => item.id === nodeId);
    if (!node) return ui.notifications.warn("Nie znaleziono karty.");
    if (node.visibility !== "gm") return ui.notifications.info("Ta karta jest już widoczna dla graczy.");
    try {
      node.visibility = "players";
      await this._saveBoard(data);
      ui.notifications.info(`Ujawniono graczom: „${node.name}”.`);
      game.socket.emit(`module.${MODULE_ID}`, { action: "reveal", name: node.name });
      await this.render({ force: true });
    } catch (error) {
      this._notifyError("Nie udało się ujawnić karty.", error);
    }
  }

  async _duplicateNode(nodeId) {
    const sourceData = this._boardData();
    const node = sourceData.nodes.find(item => item.id === nodeId);
    if (!node) return ui.notifications.warn("Nie znaleziono karty.");
    const options = this.cases.map(journal => `<option value="${journal.id}" ${journal.id === this.activeCaseId ? "selected" : ""}>${foundry.utils.escapeHTML(journal.name)}</option>`).join("");
    try {
      const values = await DialogV2.input({
        window: { title: "Kopiuj kartę do sprawy" },
        content: `<div class="form-group"><label>Sprawa docelowa</label><select name="caseId">${options}</select></div>`,
        ok: { label: "Kopiuj", icon: "fa-solid fa-copy" },
        rejectClose: false,
        modal: true
      });
      if (!values) return;
      const target = game.journal.get(String(values.caseId ?? ""));
      if (!target?.getFlag(FLAG_SCOPE, "isCase")) throw new Error("Nie znaleziono sprawy docelowej.");
      const targetData = this._boardData(target);
      const copy = foundry.utils.deepClone(node);
      copy.id = foundry.utils.randomID();
      copy.x += 40;
      copy.y += 40;
      if (!targetData.groups.some(group => group.id === copy.groupId)) delete copy.groupId;
      targetData.nodes.push(copy);
      await target.setFlag(FLAG_SCOPE, "board", targetData);
      ui.notifications.info(`Skopiowano kartę „${node.name}” do sprawy „${target.name}”.`);
      if (target.id === this.activeCaseId) await this.render({ force: true });
    } catch (error) {
      this._notifyError("Nie udało się skopiować karty.", error);
    }
  }

  async _searchCard() {
    if (!this.activeCase) return ui.notifications.warn("Najpierw wybierz sprawę.");
    const input = this.element.querySelector('[data-role="search-input"]');
    const query = String(input?.value ?? "").trim().toLocaleLowerCase(game.i18n.lang);
    if (!query) return ui.notifications.warn("Wpisz nazwę lub fragment opisu karty.");
    const data = this._boardData();
    const node = data.nodes.find(item => {
      if (this.playerView && item.visibility === "gm") return false;
      return `${item.name ?? ""} ${item.description ?? ""}`.toLocaleLowerCase(game.i18n.lang).includes(query);
    });
    if (!node) return ui.notifications.warn("Nie znaleziono pasującej karty w bieżącym widoku.");
    const boardElement = this.element.querySelector('[data-role="board"]');
    data.view.panX = boardElement.clientWidth / 2 - (node.x + CARD_WIDTH / 2) * data.view.zoom;
    data.view.panY = boardElement.clientHeight / 2 - (node.y + CARD_HEIGHT / 2) * data.view.zoom;
    this.highlightedNodeId = node.id;
    try { await this._saveBoard(data, { recordHistory: false }); await this.render({ force: true }); }
    catch (error) { this._notifyError("Nie udało się wycentrować karty.", error); }
  }

  _exportCase() {
    const journal = this.activeCase;
    if (!journal) return ui.notifications.warn("Najpierw wybierz sprawę.");
    const safeName = journal.name.replace(/[^a-z0-9ąćęłńóśźż_-]+/gi, "-").replace(/^-|-$/g, "") || "sprawa";
    const payload = { module: MODULE_ID, format: DATA_VERSION, name: journal.name, board: this._boardData(journal) };
    foundry.utils.saveDataToFile(JSON.stringify(payload, null, 2), "application/json", `wib-${safeName}.json`);
    ui.notifications.info("Wyeksportowano sprawę do pliku JSON.");
  }

  async _importCase() {
    if (!game.user.isGM) return ui.notifications.warn("Tylko MG może importować sprawy.");
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const payload = JSON.parse(await file.text());
        if (payload?.module !== MODULE_ID || ![1, DATA_VERSION].includes(payload?.format) || !payload.board || !Array.isArray(payload.board.nodes) || !Array.isArray(payload.board.edges)) {
          throw new Error("Plik nie jest prawidłowym eksportem Wizard Investigation Board.");
        }
        const JournalEntryClass = CONFIG.JournalEntry.documentClass;
        const journal = await JournalEntryClass.create({
          name: `${String(payload.name || "Importowana sprawa")} (import)`,
          ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE },
          flags: { [FLAG_SCOPE]: { isCase: true, board: normalizeBoardData(payload.board) } }
        });
        if (!journal) throw new Error("Foundry nie utworzyło importowanej sprawy.");
        this.activeCaseId = journal.id;
        ui.notifications.info(`Zaimportowano sprawę „${journal.name}”.`);
        await this.render({ force: true });
      } catch (error) {
        this._notifyError("Nie udało się zaimportować sprawy.", error);
      }
    }, { once: true });
    input.click();
  }

  async _editEdge(edgeId) {
    const data = this._boardData();
    const edge = data.edges.find(item => item.id === edgeId);
    if (!edge) return ui.notifications.warn("Nie znaleziono połączenia.");
    const from = data.nodes.find(node => node.id === edge.from);
    const to = data.nodes.find(node => node.id === edge.to);
    const currentLineStyle = LINE_STYLE_MAP[edge.lineStyle] ? edge.lineStyle : (edge.relationType === "suspicion" ? "dashed" : edge.relationType === "false" ? "dotted" : "solid");
    try {
      const values = await DialogV2.input({
        window: { title: "Edytuj połączenie" },
        content: `<p><strong>${foundry.utils.escapeHTML(from?.name ?? "?")}</strong> → <strong>${foundry.utils.escapeHTML(to?.name ?? "?")}</strong></p>` +
          `<div class="form-group"><label>Opis relacji</label><input name="label" type="text" value="${foundry.utils.escapeHTML(edge.label ?? "")}" autofocus></div>` +
          `<div class="form-group"><label>Typ relacji</label><select name="relationType"><option value="fact" ${!RELATION_MAP[edge.relationType] || edge.relationType === "fact" ? "selected" : ""}>Fakt</option><option value="suspicion" ${edge.relationType === "suspicion" ? "selected" : ""}>Podejrzenie</option><option value="false" ${edge.relationType === "false" ? "selected" : ""}>Fałszywa teoria</option></select></div>` +
          `<div class="form-group"><label>Kolor linii</label><input name="color" type="color" value="${this._validColor(edge.color)}"></div>` +
          `<div class="form-group"><label>Kształt</label><select name="shape"><option value="straight" ${edge.shape !== "curved" ? "selected" : ""}>Prosta</option><option value="curved" ${edge.shape === "curved" ? "selected" : ""}>Zakrzywiona</option></select></div>` +
          `<div class="form-group"><label>Styl</label><select name="lineStyle"><option value="solid" ${currentLineStyle === "solid" ? "selected" : ""}>Ciągła</option><option value="dashed" ${currentLineStyle === "dashed" ? "selected" : ""}>Kreskowana</option><option value="dotted" ${currentLineStyle === "dotted" ? "selected" : ""}>Kropkowana</option></select></div>` +
          `<div class="form-group"><label>Grubość</label><select name="width"><option value="2" ${Number(edge.width) === 2 ? "selected" : ""}>Cienka</option><option value="3" ${![2,5,7].includes(Number(edge.width)) ? "selected" : ""}>Normalna</option><option value="5" ${Number(edge.width) === 5 ? "selected" : ""}>Gruba</option><option value="7" ${Number(edge.width) === 7 ? "selected" : ""}>Bardzo gruba</option></select></div>` +
          `<div class="form-group"><label><input name="directed" type="checkbox" ${edge.directed === true ? "checked" : ""}> Pokaż kierunek strzałką</label></div>` +
          `<div class="form-group"><label>Widoczność</label><select name="visibility"><option value="gm" ${edge.visibility === "gm" ? "selected" : ""}>Tylko MG</option><option value="players" ${edge.visibility === "players" ? "selected" : ""}>Gracze</option></select></div>` +
          '<div class="form-group"><label><input name="remove" type="checkbox"> Usuń to połączenie</label></div>',
        ok: { label: "Zastosuj", icon: "fa-solid fa-check" },
        rejectClose: false,
        modal: true
      });
      if (!values) return;
      if (values.remove === true || values.remove === "true" || values.remove === "on") {
        data.edges = data.edges.filter(item => item.id !== edgeId);
        await this._saveBoard(data);
        ui.notifications.info("Połączenie zostało usunięte.");
      } else {
        edge.label = String(values.label ?? "").trim();
        edge.relationType = RELATION_MAP[values.relationType] ? values.relationType : "fact";
        edge.color = this._validColor(values.color);
        edge.shape = LINE_SHAPE_MAP[values.shape] ? values.shape : "straight";
        edge.lineStyle = LINE_STYLE_MAP[values.lineStyle] ? values.lineStyle : "solid";
        edge.width = [2, 3, 5, 7].includes(Number(values.width)) ? Number(values.width) : 3;
        edge.directed = values.directed === true || values.directed === "true" || values.directed === "on";
        edge.visibility = !game.user.isGM || values.visibility === "players" ? "players" : "gm";
        await this._saveBoard(data);
        ui.notifications.info("Połączenie zostało zaktualizowane.");
      }
      await this.render({ force: true });
    } catch (error) {
      this._notifyError("Nie udało się zmienić połączenia.", error);
    }
  }

  async _togglePlayerView() {
    if (!this.activeCase) return ui.notifications.warn("Najpierw wybierz sprawę.");
    this.playerView = !this.playerView;
    await this.render({ force: true });
  }

  async _onDrop(event) {
    event.preventDefault();
    const journal = this.activeCase;
    if (!journal) return ui.notifications.warn("Najpierw wybierz sprawę.");
    if (!game.user.isGM) return ui.notifications.warn("Tylko MG może dodawać dokumenty do sprawy.");
    try {
      const raw = event.dataTransfer.getData("text/plain") || event.dataTransfer.getData("application/json") || event.dataTransfer.getData("text");
      if (!raw) throw new Error("Brak danych przeciąganego elementu.");
      let payload;
      try { payload = JSON.parse(raw); }
      catch { throw new Error("Nieprawidłowy format danych drag & drop."); }
      const uuid = payload.uuid ?? foundry.utils.buildUuid({ documentName: payload.type, id: payload.id, pack: payload.pack });
      if (!uuid) throw new Error("Payload nie zawiera UUID ani danych pozwalających je utworzyć.");
      const document = await foundry.utils.fromUuid(uuid);
      if (!document) throw new Error(`Nie znaleziono dokumentu ${uuid}.`);
      const boardElement = event.currentTarget;
      const rect = boardElement.getBoundingClientRect();
      const data = this._boardData(journal);
      const x = Math.round((event.clientX - rect.left - data.view.panX) / data.view.zoom - CARD_WIDTH / 2);
      const y = Math.round((event.clientY - rect.top - data.view.panY) / data.view.zoom - CARD_HEIGHT / 2);
      await this._addDocumentCard(document, x, y, "players");
    } catch (error) {
      this._notifyError("Nie udało się dodać karty z przeciągniętego dokumentu.", error);
    }
  }

  async _addDocumentCard(document, x, y, visibility, status = "unknown") {
    const meta = TYPE_MAP[document.documentName];
    if (!meta) throw new Error(`Typ ${document.documentName} nie jest obsługiwany.`);
    const data = this._boardData();
    data.nodes.push({
      id: foundry.utils.randomID(),
      type: meta.type,
      name: document.name || "Bez nazwy",
      authorId: game.user.id,
      authorName: game.user.name,
      x,
      y,
      visibility,
      status: STATUS_MAP[status] ? status : "unknown",
      image: documentImage(document),
      documentUuid: document.uuid
    });
    await this._saveBoard(data);
    ui.notifications.info(`Dodano kartę „${document.name}”.`);
    await this.render({ force: true });
  }

  _onCardPointerDown(event, card) {
    if (event.button !== 0 || !this.canEditActiveCase || event.target.closest("button")) return;
    event.preventDefault();
    event.stopPropagation();
    const nodeId = card.dataset.nodeId;
    if (event.ctrlKey || event.metaKey) {
      if (this.selectedNodeIds.has(nodeId)) this.selectedNodeIds.delete(nodeId);
      else this.selectedNodeIds.add(nodeId);
      return this.render({ force: true });
    }
    const journal = this.activeCase;
    if (!journal) return;
    const data = this._boardData(journal);
    const node = data.nodes.find(item => item.id === nodeId);
    if (!node) return;
    if (!this.selectedNodeIds.has(nodeId)) this.selectedNodeIds.clear();
    const movingIds = this.selectedNodeIds.has(nodeId) ? new Set(this.selectedNodeIds) : new Set([nodeId]);
    const movingNodes = data.nodes.filter(item => movingIds.has(item.id));
    const origins = new Map(movingNodes.map(item => [item.id, { x: item.x, y: item.y }]));
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;
    card.setPointerCapture(event.pointerId);
    const move = moveEvent => {
      const dx = (moveEvent.clientX - startX) / data.view.zoom;
      const dy = (moveEvent.clientY - startY) / data.view.zoom;
      moved ||= Math.abs(dx) > 1 || Math.abs(dy) > 1;
      for (const item of movingNodes) {
        const origin = origins.get(item.id);
        item.x = Math.round(origin.x + dx);
        item.y = Math.round(origin.y + dy);
        const element = this.element.querySelector(`[data-node-id="${item.id}"]`);
        if (element) { element.style.left = `${item.x}px`; element.style.top = `${item.y}px`; }
      }
    };
    const finish = async finishEvent => {
      card.removeEventListener("pointermove", move);
      card.removeEventListener("pointerup", finish);
      card.removeEventListener("pointercancel", finish);
      if (card.hasPointerCapture(finishEvent.pointerId)) card.releasePointerCapture(finishEvent.pointerId);
      if (!moved) return;
      try { await this._saveBoard(data); await this.render({ force: true }); }
      catch (error) { this._notifyError("Nie udało się zapisać pozycji karty.", error); }
    };
    card.addEventListener("pointermove", move);
    card.addEventListener("pointerup", finish);
    card.addEventListener("pointercancel", finish);
  }

  _onBoardPointerDown(event) {
    if (event.button !== 0 || !event.shiftKey || event.target.closest(".wib-card")) return;
    event.preventDefault();
    const boardElement = event.currentTarget;
    const world = boardElement.querySelector('[data-role="world"]');
    const data = this._boardData();
    const startX = event.clientX;
    const startY = event.clientY;
    const originX = data.view.panX;
    const originY = data.view.panY;
    boardElement.setPointerCapture(event.pointerId);
    const move = moveEvent => {
      data.view.panX = Math.round(originX + moveEvent.clientX - startX);
      data.view.panY = Math.round(originY + moveEvent.clientY - startY);
      world.style.transform = this._viewTransform(data.view);
      this._updateMinimapViewport(data.view);
    };
    const finish = async finishEvent => {
      boardElement.removeEventListener("pointermove", move);
      boardElement.removeEventListener("pointerup", finish);
      boardElement.removeEventListener("pointercancel", finish);
      if (boardElement.hasPointerCapture(finishEvent.pointerId)) boardElement.releasePointerCapture(finishEvent.pointerId);
      try { await this._saveBoard(data, { recordHistory: false }); }
      catch (error) { this._notifyError("Nie udało się zapisać położenia planszy.", error); }
    };
    boardElement.addEventListener("pointermove", move);
    boardElement.addEventListener("pointerup", finish);
    boardElement.addEventListener("pointercancel", finish);
  }

  async _onWheel(event) {
    event.preventDefault();
    const boardElement = event.currentTarget;
    const world = boardElement.querySelector('[data-role="world"]');
    const data = this._boardData();
    const rect = boardElement.getBoundingClientRect();
    const oldZoom = data.view.zoom;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * (event.deltaY < 0 ? 1.1 : 0.9)));
    const cursorX = event.clientX - rect.left;
    const cursorY = event.clientY - rect.top;
    const worldX = (cursorX - data.view.panX) / oldZoom;
    const worldY = (cursorY - data.view.panY) / oldZoom;
    data.view.zoom = nextZoom;
    data.view.panX = cursorX - worldX * nextZoom;
    data.view.panY = cursorY - worldY * nextZoom;
    world.style.transform = this._viewTransform(data.view);
    this._updateMinimapViewport(data.view);
    clearTimeout(this._zoomSaveTimer);
    this._zoomSaveTimer = setTimeout(() => this._saveBoard(data, { recordHistory: false }).catch(error => this._notifyError("Nie udało się zapisać powiększenia.", error)), 250);
  }

  _matchesCurrentFilters(node) {
    if (this.playerView && node.visibility === "gm") return false;
    if (this.filters.type !== "all" && node.type !== this.filters.type) return false;
    if (this.filters.group !== "all" && (node.groupId ?? "none") !== this.filters.group) return false;
    const status = STATUS_MAP[node.status] ? node.status : "unknown";
    return this.filters.status === "all" || status === this.filters.status;
  }

  async _autoLayout() {
    if (!this.activeCase || !this.canEditActiveCase) return ui.notifications.warn("Nie możesz układać tej sprawy.");
    const data = this._boardData();
    const nodes = data.nodes.filter(node => this._matchesCurrentFilters(node))
      .sort((a, b) => String(a.type).localeCompare(String(b.type)) || String(a.name).localeCompare(String(b.name), game.i18n.lang));
    if (!nodes.length) return ui.notifications.warn("Brak widocznych kart do ułożenia.");
    const columns = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    nodes.forEach((node, index) => {
      node.x = 60 + (index % columns) * 280;
      node.y = 60 + Math.floor(index / columns) * 170;
    });
    try {
      await this._saveBoard(data);
      ui.notifications.info(`Automatycznie ułożono kart: ${nodes.length}.`);
      await this.render({ force: true });
      await this._fitVisible();
    } catch (error) {
      this._notifyError("Nie udało się automatycznie ułożyć kart.", error);
    }
  }

  async _fitVisible() {
    const journal = this.activeCase;
    if (!journal) return ui.notifications.warn("Najpierw wybierz sprawę.");
    const boardElement = this.element.querySelector('[data-role="board"]');
    if (!boardElement) return;
    const data = this._boardData(journal);
    const nodes = data.nodes.filter(node => this._matchesCurrentFilters(node));
    if (!nodes.length) return ui.notifications.warn("Brak widocznych kart do dopasowania.");
    const padding = 48;
    const minX = Math.min(...nodes.map(node => node.x));
    const minY = Math.min(...nodes.map(node => node.y));
    const maxX = Math.max(...nodes.map(node => node.x + CARD_WIDTH));
    const maxY = Math.max(...nodes.map(node => node.y + CARD_HEIGHT));
    const boundsWidth = Math.max(1, maxX - minX);
    const boundsHeight = Math.max(1, maxY - minY);
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min((boardElement.clientWidth - padding * 2) / boundsWidth, (boardElement.clientHeight - padding * 2) / boundsHeight)));
    data.view.zoom = zoom;
    data.view.panX = (boardElement.clientWidth - boundsWidth * zoom) / 2 - minX * zoom;
    data.view.panY = (boardElement.clientHeight - boundsHeight * zoom) / 2 - minY * zoom;
    try { await this._saveBoard(data, { recordHistory: false }); await this.render({ force: true }); }
    catch (error) { this._notifyError("Nie udało się dopasować planszy.", error); }
  }

  async _resetZoom() {
    const boardElement = this.element.querySelector('[data-role="board"]');
    if (!this.activeCase || !boardElement) return ui.notifications.warn("Najpierw wybierz sprawę.");
    const data = this._boardData();
    const centerX = (boardElement.clientWidth / 2 - data.view.panX) / data.view.zoom;
    const centerY = (boardElement.clientHeight / 2 - data.view.panY) / data.view.zoom;
    data.view.zoom = 1;
    data.view.panX = boardElement.clientWidth / 2 - centerX;
    data.view.panY = boardElement.clientHeight / 2 - centerY;
    try { await this._saveBoard(data, { recordHistory: false }); await this.render({ force: true }); }
    catch (error) { this._notifyError("Nie udało się przywrócić powiększenia.", error); }
  }

  async _validateActiveCase() {
    const journal = this.activeCase;
    if (!journal || !game.user.isGM || journal.isPlayerCase) return ui.notifications.warn("Kontrola jest dostępna dla spraw MG.");
    const original = journal.getFlag(FLAG_SCOPE, "board") ?? {};
    const normalized = normalizeBoardData(original);
    if (JSON.stringify(original) === JSON.stringify(normalized)) return ui.notifications.info("Dane sprawy są prawidłowe i aktualne.");
    try {
      const backup = journal.getFlag(FLAG_SCOPE, "migrationBackup") ?? { createdAt: Date.now(), fromVersion: Number(original.version) || 1, board: foundry.utils.deepClone(original) };
      await journal.update({ [`flags.${FLAG_SCOPE}.migrationBackup`]: backup, [`flags.${FLAG_SCOPE}.board`]: normalized });
      ui.notifications.info("Naprawiono dane sprawy. Poprzednia wersja została zachowana jako kopia migracyjna.");
      await this.render({ force: true });
    } catch (error) { this._notifyError("Nie udało się sprawdzić i naprawić sprawy.", error); }
  }

  async _restoreMigrationBackup() {
    const journal = this.activeCase;
    if (!journal || !game.user.isGM || journal.isPlayerCase) return ui.notifications.warn("Odzyskiwanie jest dostępne dla spraw MG.");
    const backup = journal.getFlag(FLAG_SCOPE, "migrationBackup");
    if (!backup?.board) return ui.notifications.warn("Ta sprawa nie ma kopii migracyjnej.");
    const backupDate = backup.createdAt ? new Intl.DateTimeFormat(game.i18n.lang, { dateStyle: "medium", timeStyle: "short" }).format(new Date(backup.createdAt)) : "nieznana";
    const confirmed = await DialogV2.confirm({
      window: { title: "Przywróć kopię sprawy" },
      content: `<p>Przywrócić kopię sprawy <strong>${foundry.utils.escapeHTML(journal.name)}</strong> z dnia <strong>${foundry.utils.escapeHTML(backupDate)}</strong>?</p><p>Obecny stan zostanie zachowany jako osobna kopia sprzed odzyskania.</p>`,
      yes: { label: "Przywróć", icon: "fa-solid fa-clock-rotate-left" }, no: { label: "Anuluj" }, rejectClose: false, modal: true
    });
    if (!confirmed) return;
    try {
      const current = journal.getFlag(FLAG_SCOPE, "board") ?? {};
      const restored = normalizeBoardData(backup.board);
      restored.revision = (Number.isSafeInteger(current.revision) ? current.revision : 0) + 1;
      const preRestoreBackup = { createdAt: Date.now(), fromRevision: Number(current.revision) || 0, board: foundry.utils.deepClone(current) };
      await journal.update({ [`flags.${FLAG_SCOPE}.preRestoreBackup`]: preRestoreBackup, [`flags.${FLAG_SCOPE}.board`]: restored });
      this.historyByCase.delete(journal.id);
      ui.notifications.info("Przywrócono kopię sprawy. Stan sprzed odzyskania również został zachowany.");
      await this.render({ force: true });
    } catch (error) { this._notifyError("Nie udało się przywrócić kopii sprawy.", error); }
  }

  _renderMinimap(boardElement) {
    const minimap = boardElement.querySelector('[data-role="minimap"]');
    if (!minimap) return;
    const data = this._boardData();
    const nodes = data.nodes.filter(node => this._matchesCurrentFilters(node));
    minimap.replaceChildren();
    if (!nodes.length) return;
    const padding = 80;
    const minX = Math.min(...nodes.map(node => node.x)) - padding;
    const minY = Math.min(...nodes.map(node => node.y)) - padding;
    const maxX = Math.max(...nodes.map(node => node.x + CARD_WIDTH)) + padding;
    const maxY = Math.max(...nodes.map(node => node.y + CARD_HEIGHT)) + padding;
    const rangeX = Math.max(1, maxX - minX);
    const rangeY = Math.max(1, maxY - minY);
    const mapWidth = minimap.clientWidth || 190;
    const mapHeight = minimap.clientHeight || 130;
    const groupIds = new Set(nodes.map(node => node.groupId).filter(Boolean));
    for (const group of data.groups.filter(item => groupIds.has(item.id))) {
      const members = nodes.filter(node => node.groupId === group.id);
      const area = document.createElement("span");
      area.className = "wib-minimap-group";
      const left = Math.min(...members.map(node => node.x));
      const top = Math.min(...members.map(node => node.y));
      const right = Math.max(...members.map(node => node.x + CARD_WIDTH));
      const bottom = Math.max(...members.map(node => node.y + CARD_HEIGHT));
      Object.assign(area.style, { left: `${(left - minX) / rangeX * mapWidth}px`, top: `${(top - minY) / rangeY * mapHeight}px`, width: `${(right - left) / rangeX * mapWidth}px`, height: `${(bottom - top) / rangeY * mapHeight}px`, borderColor: this._validColor(group.color), backgroundColor: `${this._validColor(group.color)}33` });
      minimap.append(area);
    }
    for (const node of nodes) {
      const dot = document.createElement("span");
      dot.className = `wib-minimap-card wib-minimap-${node.type ?? "note"}`;
      Object.assign(dot.style, { left: `${(node.x - minX) / rangeX * mapWidth}px`, top: `${(node.y - minY) / rangeY * mapHeight}px`, width: `${Math.max(3, CARD_WIDTH / rangeX * mapWidth)}px`, height: `${Math.max(3, CARD_HEIGHT / rangeY * mapHeight)}px` });
      minimap.append(dot);
    }
    const viewport = document.createElement("span");
    viewport.className = "wib-minimap-viewport";
    minimap.append(viewport);
    this._minimapState = { minimap, viewport, boardElement, minX, minY, rangeX, rangeY, mapWidth, mapHeight };
    this._updateMinimapViewport(data.view);
    minimap.addEventListener("wheel", event => event.stopPropagation());
    minimap.addEventListener("pointerdown", event => {
      event.preventDefault();
      event.stopPropagation();
      const rect = minimap.getBoundingClientRect();
      const worldX = minX + (event.clientX - rect.left) / rect.width * rangeX;
      const worldY = minY + (event.clientY - rect.top) / rect.height * rangeY;
      this._panFromMinimap(worldX, worldY);
    });
  }

  _updateMinimapViewport(view) {
    const state = this._minimapState;
    if (!state?.viewport?.isConnected) return;
    const worldLeft = -view.panX / view.zoom;
    const worldTop = -view.panY / view.zoom;
    Object.assign(state.viewport.style, {
      left: `${(worldLeft - state.minX) / state.rangeX * state.mapWidth}px`,
      top: `${(worldTop - state.minY) / state.rangeY * state.mapHeight}px`,
      width: `${state.boardElement.clientWidth / view.zoom / state.rangeX * state.mapWidth}px`,
      height: `${state.boardElement.clientHeight / view.zoom / state.rangeY * state.mapHeight}px`
    });
  }

  async _panFromMinimap(worldX, worldY) {
    const state = this._minimapState;
    if (!state) return;
    const data = this._boardData();
    data.view.panX = state.boardElement.clientWidth / 2 - worldX * data.view.zoom;
    data.view.panY = state.boardElement.clientHeight / 2 - worldY * data.view.zoom;
    try { await this._saveBoard(data, { recordHistory: false }); await this.render({ force: true }); }
    catch (error) { this._notifyError("Nie udało się przesunąć planszy.", error); }
  }

  async _focusTimelineNode(nodeId) {
    const data = this._boardData();
    const node = data.nodes.find(item => item.id === nodeId);
    if (!node) return ui.notifications.warn("Nie znaleziono karty na planszy.");
    const boardElement = this.element.querySelector('[data-role="board"]');
    if (!boardElement) return;
    data.view.panX = boardElement.clientWidth / 2 - (node.x + CARD_WIDTH / 2) * data.view.zoom;
    data.view.panY = boardElement.clientHeight / 2 - (node.y + CARD_HEIGHT / 2) * data.view.zoom;
    this.timelineView = false;
    this.highlightedNodeId = node.id;
    try { await this._saveBoard(data, { recordHistory: false }); await this.render({ force: true }); }
    catch (error) { this._notifyError("Nie udało się przejść do karty.", error); }
  }

  async _openCardDocument(event, card) {
    event.preventDefault();
    return this._openNodeDocument(card.dataset.nodeId);
  }

  async _saveBoard(data, { recordHistory = true, incrementRevision = recordHistory } = {}) {
    const journal = this.activeCase;
    if (!journal) throw new Error("Brak aktywnej sprawy.");
    const currentRevision = this._boardData(journal).revision;
    if (recordHistory && this.canEditActiveCase) {
      const current = this._boardData(journal);
      if (JSON.stringify(current) !== JSON.stringify(data)) {
        const history = this.historyByCase.get(journal.id) ?? [];
        history.push(current);
        if (history.length > 20) history.shift();
        this.historyByCase.set(journal.id, history);
      }
    }
    if (journal.isPlayerCase && this.canEditActiveCase) {
      const owner = game.users.get(journal.createdBy);
      if (!owner) throw new Error("Nie znaleziono właściciela sprawy gracza.");
      const cases = foundry.utils.deepClone(owner.getFlag(FLAG_SCOPE, "playerCases") ?? []);
      const index = cases.findIndex(item => item.id === journal.id);
      if (index < 0) throw new Error("Nie znaleziono sprawy gracza.");
      data.revision = incrementRevision ? currentRevision + 1 : currentRevision;
      const cleanBoard = sanitizePlayerBoard(data, cases[index].board);
      cases[index].board = cleanBoard;
      journal.board = foundry.utils.deepClone(cleanBoard);
      await owner.setFlag(FLAG_SCOPE, "playerCases", cases);
      return;
    }
    if (!game.user.isGM && journal.editorIds?.includes(game.user.id)) {
      if (!incrementRevision) {
        journal.board = foundry.utils.deepClone(data);
        return;
      }
      const expectedRevision = currentRevision;
      data.revision = expectedRevision + 1;
      journal.board = foundry.utils.deepClone(data);
      const requests = foundry.utils.deepClone(game.user.getFlag(FLAG_SCOPE, "collabRequests") ?? []);
      requests.push({ id: foundry.utils.randomID(), caseId: journal.id, expectedRevision, board: data, createdAt: Date.now() });
      await game.user.setFlag(FLAG_SCOPE, "collabRequests", requests.slice(-25));
      return;
    }
    if (!game.user.isGM) {
      throw new Error("Nie masz uprawnień do zapisu tej sprawy.");
    }
    if (!journal.isOwner) throw new Error("Nie masz uprawnień do edycji tej sprawy.");
    data.revision = incrementRevision ? currentRevision + 1 : currentRevision;
    await journal.setFlag(FLAG_SCOPE, "board", data);
  }

  async _undo() {
    const journal = this.activeCase;
    const history = this.historyByCase.get(journal?.id) ?? [];
    if (!journal || !history.length) return ui.notifications.warn("Brak zmian do cofnięcia.");
    const previous = history.pop();
    this.historyByCase.set(journal.id, history);
    try {
      await this._saveBoard(previous, { recordHistory: false, incrementRevision: true });
      ui.notifications.info("Cofnięto ostatnią zmianę.");
      await this.render({ force: true });
    } catch (error) {
      history.push(previous);
      this._notifyError("Nie udało się cofnąć zmiany.", error);
    }
  }

  _viewTransform(view) {
    return `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`;
  }

  _validColor(value) {
    const color = String(value ?? "").trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color : DEFAULT_EDGE_COLOR;
  }

  _notifyError(message, error) {
    console.error(`${MODULE_ID} | ${message}`, error);
    ui.notifications.error(`${message} ${error?.message ?? "Nieznany błąd."}`);
  }
}

function publicCasesPayload(viewerId = null) {
  if (!game.user.isGM) return [];
  return game.journal
    .filter(journal => journal.getFlag(FLAG_SCOPE, "isCase") === true && journal.getFlag(FLAG_SCOPE, "caseVisibility") !== "gm")
    .filter(journal => {
      const viewers = journal.getFlag(FLAG_SCOPE, "viewerIds") ?? [];
      const editors = journal.getFlag(FLAG_SCOPE, "editorIds") ?? [];
      const restricted = journal.getFlag(FLAG_SCOPE, "accessRestricted") === true;
      return !viewerId || !restricted || viewers.includes(viewerId) || editors.includes(viewerId);
    })
    .map(journal => {
      const source = journal.getFlag(FLAG_SCOPE, "board") ?? {};
      const nodes = Array.isArray(source.nodes)
        ? source.nodes.filter(node => node.visibility !== "gm").map(node => ({
            id: node.id,
            type: node.type,
            name: node.name,
            description: node.description ?? "",
            x: node.x,
            y: node.y,
            visibility: "players",
            status: node.status ?? "unknown",
            groupId: node.groupId ?? null,
            eventDate: typeof node.eventDate === "string" ? node.eventDate : "",
            dateApproximate: node.dateApproximate === true,
            authorId: node.authorId ?? null,
            authorName: node.authorName ?? "",
            image: typeof node.image === "string" && node.image ? node.image : (node.documentUuid ? documentImage(foundry.utils.fromUuidSync(node.documentUuid)) : null),
            documentUuid: node.documentUuid ?? null
          }))
        : [];
      const usedGroupIds = new Set(nodes.map(node => node.groupId).filter(Boolean));
      const groups = Array.isArray(source.groups) ? source.groups.filter(group => usedGroupIds.has(group.id)).map(group => ({ id: group.id, name: String(group.name ?? "Grupa").slice(0, 100), color: /^#[0-9a-f]{6}$/i.test(String(group.color ?? "")) ? group.color : DEFAULT_EDGE_COLOR })) : [];
      const visibleIds = new Set(nodes.map(node => node.id));
      const edges = Array.isArray(source.edges)
        ? source.edges.filter(edge => edge.visibility !== "gm" && visibleIds.has(edge.from) && visibleIds.has(edge.to)).map(edge => ({
            id: edge.id,
            from: edge.from,
            to: edge.to,
            label: edge.label ?? "",
            color: edge.color ?? DEFAULT_EDGE_COLOR,
            relationType: edge.relationType ?? "fact",
            shape: LINE_SHAPE_MAP[edge.shape] ? edge.shape : "straight",
            lineStyle: LINE_STYLE_MAP[edge.lineStyle] ? edge.lineStyle : (edge.relationType === "suspicion" ? "dashed" : edge.relationType === "false" ? "dotted" : "solid"),
            width: [2, 3, 5, 7].includes(Number(edge.width)) ? Number(edge.width) : 3,
            directed: edge.directed === true,
            visibility: "players"
          }))
        : [];
      return {
        id: journal.id,
        name: journal.name,
        createdBy: journal.getFlag(FLAG_SCOPE, "createdBy") ?? null,
        editorIds: foundry.utils.deepClone(journal.getFlag(FLAG_SCOPE, "editorIds") ?? []),
        board: {
          version: DATA_VERSION,
          revision: Number.isSafeInteger(source.revision) && source.revision >= 0 ? source.revision : 0,
          nodes,
          edges,
          groups,
          view: foundry.utils.deepClone(source.view ?? { panX: 60, panY: 60, zoom: 1 })
        }
      };
    });
}

function sanitizePlayerBoard(board, currentBoard = {}) {
  const groups = (Array.isArray(board?.groups) ? board.groups : []).slice(0, 100).map(group => ({ id: typeof group.id === "string" && group.id ? group.id : foundry.utils.randomID(), name: String(group.name ?? "Grupa").trim().slice(0, 100) || "Grupa", color: /^#[0-9a-f]{6}$/i.test(String(group.color ?? "")) ? group.color : DEFAULT_EDGE_COLOR }));
  const groupIds = new Set(groups.map(group => group.id));
  const existingNodes = new Map((Array.isArray(currentBoard.nodes) ? currentBoard.nodes : []).map(node => [node.id, node]));
  const rawNodes = Array.isArray(board?.nodes) ? board.nodes.slice(0, 500) : [];
  const nodes = rawNodes.map(node => {
    const existing = existingNodes.get(node.id);
    return {
    id: typeof node.id === "string" && node.id ? node.id : foundry.utils.randomID(),
    type: existing?.type ?? "note",
    name: String(node.name ?? "Notatka").trim().slice(0, 120) || "Notatka",
    description: String(node.description ?? "").slice(0, 4000),
    x: Number.isFinite(node.x) ? Math.max(-100000, Math.min(100000, node.x)) : 0,
    y: Number.isFinite(node.y) ? Math.max(-100000, Math.min(100000, node.y)) : 0,
    visibility: "players",
    status: STATUS_MAP[node.status] ? node.status : "unknown",
    ...(groupIds.has(node.groupId) ? { groupId: node.groupId } : {}),
    eventDate: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(node.eventDate ?? "")) ? node.eventDate : "",
    dateApproximate: node.dateApproximate === true,
    authorId: existing?.authorId ?? (typeof node.authorId === "string" ? node.authorId : null),
    authorName: existing?.authorName ?? String(node.authorName ?? "").slice(0, 120),
    ...(existing?.image ? { image: existing.image } : {}),
    ...(existing?.documentUuid ? { documentUuid: existing.documentUuid } : {})
  }; });
  const ids = new Set(nodes.map(node => node.id));
  const edges = (Array.isArray(board?.edges) ? board.edges : []).slice(0, 1000)
    .filter(edge => ids.has(edge.from) && ids.has(edge.to) && edge.from !== edge.to)
    .map(edge => ({
      id: typeof edge.id === "string" && edge.id ? edge.id : foundry.utils.randomID(),
      from: edge.from,
      to: edge.to,
      label: String(edge.label ?? "").slice(0, 240),
      color: /^#[0-9a-f]{6}$/i.test(String(edge.color ?? "")) ? edge.color : DEFAULT_EDGE_COLOR,
      relationType: RELATION_MAP[edge.relationType] ? edge.relationType : "suspicion",
      shape: LINE_SHAPE_MAP[edge.shape] ? edge.shape : "straight",
      lineStyle: LINE_STYLE_MAP[edge.lineStyle] ? edge.lineStyle : (edge.relationType === "suspicion" ? "dashed" : edge.relationType === "false" ? "dotted" : "solid"),
      width: [2, 3, 5, 7].includes(Number(edge.width)) ? Number(edge.width) : 3,
      directed: edge.directed === true,
      visibility: "players"
    }));
  return {
    version: DATA_VERSION,
    revision: Number.isSafeInteger(board?.revision) && board.revision >= 0 ? board.revision : (Number.isSafeInteger(currentBoard?.revision) ? currentBoard.revision : 0),
    nodes,
    edges,
    groups,
    view: {
      panX: Number.isFinite(board?.view?.panX) ? board.view.panX : 60,
      panY: Number.isFinite(board?.view?.panY) ? board.view.panY : 60,
      zoom: Number.isFinite(board?.view?.zoom) ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, board.view.zoom)) : 1
    }
  };
}

function mergeCollaborativeBoard(incomingBoard, currentBoard, user) {
  const cleaned = sanitizePlayerBoard(incomingBoard, currentBoard);
  const currentNodes = Array.isArray(currentBoard?.nodes) ? currentBoard.nodes : [];
  const existingById = new Map(currentNodes.map(node => [node.id, node]));
  for (const node of cleaned.nodes) {
    const existing = existingById.get(node.id);
    node.authorId = existing?.authorId ?? user.id;
    node.authorName = existing?.authorName ?? user.name;
  }
  const secretNodes = currentNodes.filter(node => node.visibility === "gm");
  const secretIds = new Set(secretNodes.map(node => node.id));
  const secretEdges = (Array.isArray(currentBoard?.edges) ? currentBoard.edges : []).filter(edge => edge.visibility === "gm" || secretIds.has(edge.from) || secretIds.has(edge.to));
  const groups = [...cleaned.groups];
  const groupIds = new Set(groups.map(group => group.id));
  for (const group of Array.isArray(currentBoard?.groups) ? currentBoard.groups : []) {
    if (!groupIds.has(group.id) && secretNodes.some(node => node.groupId === group.id)) groups.push(foundry.utils.deepClone(group));
  }
  return {
    version: DATA_VERSION,
    revision: Number.isSafeInteger(currentBoard?.revision) && currentBoard.revision >= 0 ? currentBoard.revision : 0,
    nodes: [...cleaned.nodes, ...foundry.utils.deepClone(secretNodes)],
    edges: [...cleaned.edges, ...foundry.utils.deepClone(secretEdges)],
    groups,
    view: foundry.utils.deepClone(currentBoard?.view ?? cleaned.view)
  };
}

const processedCollabRequests = new Set();
const collabQueues = new Map();

function enqueueCollaborativeRequest(user) {
  const previous = collabQueues.get(user.id) ?? Promise.resolve();
  const next = previous.then(() => processCollaborativeRequest(user)).catch(error => console.error(`${MODULE_ID} | Kolejka zapisu współdzielonego nie powiodła się.`, error));
  collabQueues.set(user.id, next);
  next.finally(() => { if (collabQueues.get(user.id) === next) collabQueues.delete(user.id); });
}

async function processCollaborativeRequest(user) {
  if (!game.user.isGM) return;
  const responsibleGM = game.users.filter(item => item.isGM && item.active).sort((a, b) => a.id.localeCompare(b.id))[0];
  if (responsibleGM?.id !== game.user.id) return;
  const queued = foundry.utils.deepClone(user.getFlag(FLAG_SCOPE, "collabRequests") ?? []);
  const legacy = user.getFlag(FLAG_SCOPE, "collabRequest");
  if (legacy?.id) queued.unshift({ ...legacy, expectedRevision: Number.isSafeInteger(legacy.expectedRevision) ? legacy.expectedRevision : Number(legacy.board?.revision) || 0 });
  const requests = queued.filter(request => request?.id && !processedCollabRequests.has(request.id)).sort((a, b) => Number(a.createdAt) - Number(b.createdAt));
  if (!requests.length) return;
  const handledIds = new Set();
  for (const request of requests) {
    processedCollabRequests.add(request.id);
    handledIds.add(request.id);
    try {
      const journal = game.journal.get(request.caseId);
      if (!journal?.getFlag(FLAG_SCOPE, "isCase")) throw new Error("Sprawa nie istnieje.");
      const editors = journal.getFlag(FLAG_SCOPE, "editorIds") ?? [];
      if (!editors.includes(user.id)) throw new Error("Gracz nie ma prawa edycji tej sprawy.");
      const current = journal.getFlag(FLAG_SCOPE, "board") ?? {};
      const currentRevision = Number.isSafeInteger(current.revision) ? current.revision : 0;
      if (request.expectedRevision !== currentRevision) {
        game.socket.emit(`module.${MODULE_ID}`, { action: "collab-conflict", targetUserId: user.id, caseId: journal.id, expectedRevision: request.expectedRevision, currentRevision });
        continue;
      }
      const merged = mergeCollaborativeBoard(request.board, current, user);
      merged.revision = currentRevision + 1;
      await journal.setFlag(FLAG_SCOPE, "board", merged);
      game.socket.emit(`module.${MODULE_ID}`, { action: "collab-saved", targetUserId: user.id, caseId: journal.id, revision: merged.revision });
    } catch (error) {
      console.error(`${MODULE_ID} | Odrzucono zapis współdzielonej sprawy.`, error);
      game.socket.emit(`module.${MODULE_ID}`, { action: "collab-error", targetUserId: user.id, message: error.message });
    }
  }
  const latest = foundry.utils.deepClone(user.getFlag(FLAG_SCOPE, "collabRequests") ?? []);
  const remaining = latest.filter(request => !handledIds.has(request?.id));
  if (remaining.length) await user.setFlag(FLAG_SCOPE, "collabRequests", remaining);
  else await user.unsetFlag(FLAG_SCOPE, "collabRequests");
  if (legacy?.id && handledIds.has(legacy.id)) await user.unsetFlag(FLAG_SCOPE, "collabRequest");
}

function collectPlayerCases() {
  const cases = [];
  for (const user of game.users) {
    const stored = user.getFlag(FLAG_SCOPE, "playerCases");
    if (!Array.isArray(stored)) continue;
    for (const item of stored) {
      if (!item?.id || !item?.board) continue;
      cases.push({
        id: item.id,
        name: String(item.name ?? "Sprawa gracza"),
        createdBy: user.id,
        isPlayerCase: true,
        board: foundry.utils.deepClone(item.board)
      });
    }
  }
  return cases;
}

function collectPublishedCases() {
  const map = new Map();
  const published = game.user.getFlag(FLAG_SCOPE, "sharedCases");
  if (Array.isArray(published)) for (const item of published) if (item?.id && item?.board) map.set(item.id, foundry.utils.deepClone(item));
  for (const item of collectPlayerCases()) map.set(item.id, item);
  return [...map.values()];
}

async function publishPublicCasesFlag() {
  if (!game.user.isGM) return;
  for (const user of game.users.filter(item => !item.isGM)) {
    const next = publicCasesPayload(user.id);
    const current = user.getFlag(FLAG_SCOPE, "sharedCases") ?? [];
    if (JSON.stringify(current) !== JSON.stringify(next)) await user.setFlag(FLAG_SCOPE, "sharedCases", next);
  }
}

function refreshRemoteCases() {
  if (game.user.isGM || !boardApp) return;
  boardApp.receivePublicCases(collectPublishedCases());
}

async function migrateWorldData() {
  if (!game.user.isGM) return 0;
  let migrated = 0;
  for (const journal of game.journal.filter(item => item.getFlag(FLAG_SCOPE, "isCase") === true)) {
    const board = journal.getFlag(FLAG_SCOPE, "board") ?? {};
    if (Number(board.version) >= DATA_VERSION) continue;
    try {
      const backup = journal.getFlag(FLAG_SCOPE, "migrationBackup") ?? { createdAt: Date.now(), fromVersion: Number(board.version) || 1, board: foundry.utils.deepClone(board) };
      await journal.update({ [`flags.${FLAG_SCOPE}.migrationBackup`]: backup, [`flags.${FLAG_SCOPE}.board`]: normalizeBoardData(board) });
      migrated += 1;
    } catch (error) { console.error(`${MODULE_ID} | Nie udało się zmigrować sprawy ${journal.name}.`, error); }
  }
  for (const user of game.users) {
    const cases = user.getFlag(FLAG_SCOPE, "playerCases");
    if (!Array.isArray(cases) || !cases.some(item => (Number(item?.board?.version) || 1) < DATA_VERSION)) continue;
    try {
      const backup = user.getFlag(FLAG_SCOPE, "playerCasesMigrationBackup") ?? { createdAt: Date.now(), cases: foundry.utils.deepClone(cases) };
      const migratedCases = cases.map(item => ({ ...item, board: (Number(item?.board?.version) || 1) >= DATA_VERSION ? item.board : normalizeBoardData(item.board) }));
      await user.update({ [`flags.${FLAG_SCOPE}.playerCasesMigrationBackup`]: backup, [`flags.${FLAG_SCOPE}.playerCases`]: migratedCases });
      migrated += migratedCases.filter((item, index) => item.board !== cases[index].board).length;
    } catch (error) { console.error(`${MODULE_ID} | Nie udało się zmigrować spraw użytkownika ${user.name}.`, error); }
  }
  return migrated;
}

let boardApp;

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "showImages", {
    name: "Pokazuj grafiki na kartach",
    hint: "Wyświetlaj portrety i miniatury powiązanych dokumentów na tablicy śledztwa.",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", async () => {
  boardApp = new InvestigationBoard();
  game.socket.on(`module.${MODULE_ID}`, message => {
    if (message?.action === "reveal" && !game.user.isGM) {
      ui.notifications.info(`Odkryto nowy trop: ${message.name}`);
    }
    if (message?.targetUserId === game.user.id && message.action === "collab-saved") {
      ui.notifications.info("MG zapisał zmiany we współdzielonej sprawie.");
    }
    if (message?.targetUserId === game.user.id && message.action === "collab-error") {
      ui.notifications.error(`Nie udało się zapisać współdzielonej sprawy: ${message.message}`);
    }
    if (message?.targetUserId === game.user.id && message.action === "collab-conflict") {
      ui.notifications.warn("Współdzielona sprawa została w międzyczasie zmieniona przez inną osobę. Nieaktualny zapis odrzucono i pobrano najnowszą wersję.");
      refreshRemoteCases();
    }
  });
  if (game.user.isGM) {
    const migrated = await migrateWorldData();
    if (migrated) ui.notifications.info(`Wizard Investigation Board: zaktualizowano sprawy: ${migrated}. Utworzono kopie migracyjne.`);
    publishPublicCasesFlag().catch(error => console.error(`${MODULE_ID} | Publikacja spraw nie powiodła się.`, error));
    for (const user of game.users.filter(item => !item.isGM && (item.getFlag(FLAG_SCOPE, "collabRequest") || item.getFlag(FLAG_SCOPE, "collabRequests")?.length))) enqueueCollaborativeRequest(user);
  } else refreshRemoteCases();
});

Hooks.on("getSceneControlButtons", controls => {
  const control = controls.tokens ?? Object.values(controls)[0];
  if (!control?.tools) return;
  control.tools.wizardInvestigationBoard = {
    name: "wizardInvestigationBoard",
    title: "Wizard Investigation Board",
    icon: "fa-solid fa-diagram-project",
    order: Object.keys(control.tools).length,
    button: true,
    visible: true,
    onChange: () => {
      if (!boardApp) boardApp = new InvestigationBoard();
      if (!game.user.isGM) refreshRemoteCases();
      if (boardApp.rendered) boardApp.close();
      else boardApp.render({ force: true });
    }
  };
});

for (const hook of ["createJournalEntry", "updateJournalEntry", "deleteJournalEntry"]) {
  Hooks.on(hook, journal => {
    const wasCase = journal.getFlag(FLAG_SCOPE, "isCase") === true;
    if (game.user.isGM && (wasCase || journal.id === boardApp?.activeCaseId)) publishPublicCasesFlag().catch(error => console.error(`${MODULE_ID} | Publikacja spraw nie powiodła się.`, error));
    if (boardApp?.rendered && (wasCase || journal.id === boardApp.activeCaseId)) boardApp.render({ force: true });
  });
}

Hooks.on("updateUser", user => {
  if (game.user.isGM && (user.getFlag(FLAG_SCOPE, "collabRequest") || user.getFlag(FLAG_SCOPE, "collabRequests")?.length)) enqueueCollaborativeRequest(user);
  if (!game.user.isGM) refreshRemoteCases();
  if (boardApp?.rendered && game.user.isGM && Array.isArray(user.getFlag(FLAG_SCOPE, "playerCases"))) boardApp.render({ force: true });
});

globalThis.WizardInvestigationBoard = { open: () => {
  if (!boardApp) boardApp = new InvestigationBoard();
  return boardApp.render({ force: true });
} };
