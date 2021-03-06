/* ***** BEGIN LICENSE BLOCK ***** 
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is the Tree Style Tab.
 *
 * The Initial Developer of the Original Code is YUKI "Piro" Hiroshi.
 * Portions created by the Initial Developer are Copyright (C) 2011-2017
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s): YUKI "Piro" Hiroshi <piro.outsider.reflex@gmail.com>
 *                 wanabe <https://github.com/wanabe>
 *                 Tetsuharu OHZEKI <https://github.com/saneyuki>
 *                 Xidorn Quan <https://github.com/upsuper> (Firefox 40+ support)
 *                 lv7777 (https://github.com/lv7777)
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ******/
'use strict';

function isMiddleClick(aEvent) {
  return aEvent.button == 1;
}

function isAccelAction(aEvent) {
  return isMiddleClick(aEvent) || (aEvent.button == 0 && isAccelKeyPressed(aEvent));
}

function isAccelKeyPressed(aEvent) {
  return gIsMac ?
    (aEvent.metaKey || ('keyCode' in aEvent && aEvent.keyCode == aEvent.DOM_VK_META)) :
    (aEvent.ctrlKey || ('keyCode' in aEvent && aEvent.keyCode == aEvent.DOM_VK_CONTROL)) ;
}

function isCopyAction(aEvent) {
  return isAccelKeyPressed(aEvent) ||
           (aEvent.dataTransfer && aEvent.dataTransfer.dropEffect == 'copy');
}

function isEventFiredOnTwisty(aEvent) {
  var tab = getTabFromEvent(aEvent);
  if (!tab || !hasChildTabs(tab))
    return false;

  return evaluateXPath(
    `ancestor-or-self::*[${hasClass(kTWISTY)}]`,
    aEvent.originalTarget || aEvent.target,
    XPathResult.BOOLEAN_TYPE
  ).booleanValue;
}

function isEventFiredOnSoundButton(aEvent) {
  return evaluateXPath(
    `ancestor-or-self::*[${hasClass(kSOUND_BUTTON)}]`,
    aEvent.originalTarget || aEvent.target,
    XPathResult.BOOLEAN_TYPE
  ).booleanValue;
}

function isEventFiredOnClosebox(aEvent) {
  return evaluateXPath(
    `ancestor-or-self::*[${hasClass(kCLOSEBOX)}]`,
    aEvent.originalTarget || aEvent.target,
    XPathResult.BOOLEAN_TYPE
  ).booleanValue;
}

function isEventFiredOnNewTabButton(aEvent) {
  return evaluateXPath(
    `ancestor-or-self::*[${hasClass(kNEWTAB_BUTTON)}]`,
    aEvent.originalTarget || aEvent.target,
    XPathResult.BOOLEAN_TYPE
  ).booleanValue;
}

function isEventFiredOnContextualIdentitySelector(aEvent) {
  return evaluateXPath(
    `ancestor-or-self::*[${hasClass(kCONTEXTUAL_IDENTITY_SELECTOR)}]`,
    aEvent.originalTarget || aEvent.target,
    XPathResult.BOOLEAN_TYPE
  ).booleanValue;
}

function isEventFiredOnClickable(aEvent) {
  return evaluateXPath(
    'ancestor-or-self::*[contains(" button scrollbar select ", concat(" ", local-name(), " "))]',
    aEvent.originalTarget || aEvent.target,
    XPathResult.BOOLEAN_TYPE
  ).booleanValue;
}

function isEventFiredOnScrollbar(aEvent) {
  return evaluateXPath(
    'ancestor-or-self::*[local-name()="scrollbar" or local-name()="nativescrollbar"]',
    aEvent.originalTarget || aEvent.target,
    XPathResult.BOOLEAN_TYPE
  ).booleanValue;
}


function getTabFromEvent(aEvent) {
  return getTabFromChild(aEvent.target);
}

function getTabsContainerFromEvent(aEvent) {
  return getTabsContainer(aEvent.target);
}

function getTabFromTabbarEvent(aEvent) {
  if (!configs.shouldDetectClickOnIndentSpaces ||
      isEventFiredOnClickable(aEvent))
    return null;
  return getTabFromCoordinates(aEvent);
}

function getClickedOptionFromEvent(aEvent) {
  return evaluateXPath(
    'ancestor-or-self::*[contains(" option ", concat(" ", local-name(), " "))]',
    aEvent.originalTarget || aEvent.target,
    XPathResult.FIRST_ORDERED_NODE_TYPE
  ).singleNodeValue;
}

function getTabFromCoordinates(aEvent) {
  var tab = document.elementFromPoint(aEvent.clientX, aEvent.clientY);
  tab = getTabFromChild(tab);
  if (tab)
    return tab;

  var container = getTabsContainerFromEvent(aEvent);
  if (!container)
    return null;

  // because tab style can be modified, we try to find tab from
  // left, middle, and right.
  var containerRect = container.getBoundingClientRect();
  var trialPoints = [
    gFaviconSize,
    containerRect.width / 2,
    containerRect.width - gFaviconSize
  ];
  for (let x of trialPoints) {
    let tab = getTabFromChild(document.elementFromPoint(x, aEvent.clientY));
    if (tab)
      return tab;
  }
  return null;
}


/* handlers for DOM events */

function onResize(aEvent) {
  reserveToUpdateTabbarLayout({
    reason: kTABBAR_UPDATE_REASON_RESIZE
  });
  reserveToUpdateIndent();
}

function onContextMenu(aEvent) {
  aEvent.stopPropagation();
  aEvent.preventDefault();
  var tab = getTabFromEvent(aEvent);
  tabContextMenu.open({
    tab:  tab && tab.apiTab,
    left: aEvent.clientX,
    top:  aEvent.clientY
  });
}

var gLastMousedown = null;

function onMouseDown(aEvent) {
  cancelHandleMousedown();
  tabContextMenu.close();

  var tab = getTabFromEvent(aEvent) || getTabFromTabbarEvent(aEvent);
  if (configs.logOnMouseEvent)
    log('onMouseDown: found target tab: ', tab);

  var mousedownDetail = {
    targetType:    getMouseEventTargetType(aEvent),
    tab:           tab && tab.id,
    closebox:      isEventFiredOnClosebox(aEvent),
    button:        aEvent.button,
    ctrlKey:       aEvent.ctrlKey,
    shiftKey:      aEvent.shiftKey,
    altKey:        aEvent.altKey,
    metaKey:       aEvent.metaKey,
    isMiddleClick: isMiddleClick(aEvent),
    isAccelClick:  isAccelAction(aEvent)
  };
  if (configs.logOnMouseEvent)
    log('onMouseDown ', mousedownDetail);

  if (mousedownDetail.isMiddleClick) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
  }

  if ((!isEventFiredOnTwisty(aEvent) &&
       !isEventFiredOnSoundButton(aEvent) &&
       !isEventFiredOnClosebox(aEvent)) ||
      aEvent.button != 0)
    browser.runtime.sendMessage(Object.assign({}, mousedownDetail, {
      type:     kNOTIFY_TAB_MOUSEDOWN,
      windowId: gTargetWindow
    }));

  gLastMousedown = {
    detail: mousedownDetail
  };
  gLastMousedown.timeout = setTimeout(() => {
    if (!gLastMousedown)
      return;
    if (configs.logOnMouseEvent)
      log('onMouseDown expired');
    gLastMousedown.expired = true;
    if (aEvent.button == 0)
      notifyTSTAPIDragReady(tab, gLastMousedown.detail.closebox);
  }, configs.startDragTimeout);
}

function notifyTSTAPIDragReady(aTab, aIsClosebox) {
  sendTSTAPIMessage({
    type:   kTSTAPI_NOTIFY_TAB_DRAGREADY,
    tab:    serializeTabForTSTAPI(aTab),
    window: gTargetWindow,
    startOnClosebox: aIsClosebox
  });
  gReadyToCaptureMouseEvents = true;
}

function getMouseEventTargetType(aEvent) {
  if (getTabFromEvent(aEvent))
    return 'tab';

  if (isEventFiredOnNewTabButton(aEvent))
    return 'newtabbutton';

  if (isEventFiredOnContextualIdentitySelector(aEvent))
    return 'contextualidentityselector';

  var allRange = document.createRange();
  allRange.selectNodeContents(document.body);
  var containerRect = allRange.getBoundingClientRect();
  allRange.detach();
  if (aEvent.clientX < containerRect.left ||
      aEvent.clientX > containerRect.right ||
      aEvent.clientY < containerRect.top ||
      aEvent.clientY > containerRect.bottom)
    return 'outside';

  return 'blank';
}

function cancelHandleMousedown() {
  if (gLastMousedown) {
    clearTimeout(gLastMousedown.timeout);
    gLastMousedown = null;
    return true;
  }
  return false;
}

async function onMouseUp(aEvent) {
  let tab = getTabFromEvent(aEvent);

  let serializedTab = tab && serializeTabForTSTAPI(tab);
  if (serializedTab && gLastMousedown) {
    sendTSTAPIMessage(Object.assign({}, gLastMousedown.detail, {
      type:    kTSTAPI_NOTIFY_TAB_MOUSEUP,
      tab:     serializedTab,
      window:  gTargetWindow
    }));
  }

  if (gCapturingMouseEvents) {
    window.removeEventListener('mouseover', onTSTAPIDragEnter, { capture: true });
    window.removeEventListener('mouseout',  onTSTAPIDragExit, { capture: true });
    document.releaseCapture();

    sendTSTAPIMessage({
      type:    kTSTAPI_NOTIFY_TAB_DRAGEND,
      tab:     serializedTab,
      window:  gTargetWindow,
      clientX: aEvent.clientX,
      clientY: aEvent.clientY
    });

    gLastDragEnteredTab = null;
    gLastDragEnteredTarget = null;
  }
  else if (gReadyToCaptureMouseEvents) {
    sendTSTAPIMessage({
      type:    kTSTAPI_NOTIFY_TAB_DRAGCANCEL,
      tab:     serializedTab,
      window:  gTargetWindow,
      clientX: aEvent.clientX,
      clientY: aEvent.clientY
    });
  }
  gCapturingMouseEvents = false;
  gReadyToCaptureMouseEvents = false;

  if (!gLastMousedown ||
      gLastMousedown.detail.targetType != getMouseEventTargetType(aEvent) ||
      (tab && tab != getTabById(gLastMousedown.detail.tab)))
    return;

  if (configs.logOnMouseEvent)
    log('onMouseUp ', gLastMousedown.detail);

  var handled = false;
  var actionForNewTabCommand = gLastMousedown.detail.isAccelClick ?
    configs.autoAttachOnNewTabButtonMiddleClick :
    configs.autoAttachOnNewTabCommand;
  if (isEventFiredOnNewTabButton(aEvent)) {
    if (configs.logOnMouseEvent)
      log('click on the new tab button');
    handleNewTabAction(aEvent, {
      action: actionForNewTabCommand
    });
    handled = true;
  }
  else if (isEventFiredOnContextualIdentitySelector(aEvent)) {
    if (configs.logOnMouseEvent)
      log('click on the contextual identity selector');
    handled = true;
    /*
    // Disable these mimpelentation until the selector is reimplemented without <select>.
    // See: https://github.com/piroor/treestyletab/issues/1571
    let option = getClickedOptionFromEvent(aEvent);
    if (option) {
      handleNewTabAction(aEvent, {
        action:        actionForNewTabCommand,
        cookieStoreId: option.getAttribute('value')
      });
      handled = true;
    }
    else { // treat as a click on new tab button
      if (configs.logOnMouseEvent)
        log('click on the new tab button (fallback)');
      handleNewTabAction(aEvent, {
        action: actionForNewTabCommand
      });
      handled = true;
    }
    */
  }
  else if (tab/* && warnAboutClosingTabSubtreeOf(tab)*/ &&
           gLastMousedown.detail.isMiddleClick) { // Ctrl-click doesn't close tab on Firefox's tab bar!
    if (configs.logOnMouseEvent)
      log('middle click on a tab');
    //log('middle-click to close');
    removeTabInternally(tab, { inRemote: true });
    handled = true;
  }

  if (!tab && !handled) {
    if (configs.logOnMouseEvent)
      log('notify as a blank area click to other addons');
    let results = await sendTSTAPIMessage(Object.assign({}, gLastMousedown.detail, {
      type:   kTSTAPI_NOTIFY_TABBAR_MOUSEUP,
      window: gTargetWindow,
    }));
    results = results.concat(await sendTSTAPIMessage(Object.assign({}, gLastMousedown.detail, {
      type:   kTSTAPI_NOTIFY_TABBAR_CLICKED,
      window: gTargetWindow,
    })));
    if (results.some(aResult => aResult.result)) { // canceled
      cancelHandleMousedown();
      return;
    }
  }

  if (!handled &&
      gLastMousedown.detail.isMiddleClick) { // Ctrl-click does nothing on Firefox's tab bar!
    if (configs.logOnMouseEvent)
      log('default action for middle click on the blank area');
    handleNewTabAction(aEvent, {
      action: configs.autoAttachOnNewTabCommand
    });
  }

  cancelHandleMousedown();
}

function onClick(aEvent) {
  if (aEvent.button != 0) // ignore non-left click
    return;

  if (configs.logOnMouseEvent)
    log('onClick', String(aEvent.target));

  if (isEventFiredOnContextualIdentitySelector(aEvent) ||
      isEventFiredOnNewTabButton(aEvent)) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
    return;
  }

  var tab = getTabFromEvent(aEvent);
  if (configs.logOnMouseEvent)
    log('clicked tab: ', tab);

  if (isEventFiredOnTwisty(aEvent)) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
    if (configs.logOnMouseEvent)
      log('clicked on twisty');
    if (hasChildTabs(tab))
      collapseExpandSubtree(tab, {
        collapsed:       !isSubtreeCollapsed(tab),
        manualOperation: true,
        inRemote:        true
      });
    return;
  }

  if (isEventFiredOnSoundButton(aEvent)) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
    if (configs.logOnMouseEvent)
      log('clicked on sound button');
    browser.runtime.sendMessage({
      type:     kCOMMAND_SET_SUBTREE_MUTED,
      windowId: gTargetWindow,
      tab:      tab.id,
      muted:    maybeSoundPlaying(tab)
    });
    return;
  }

  if (isEventFiredOnClosebox(aEvent)) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
    if (configs.logOnMouseEvent)
      log('clicked on closebox');
    //if (!warnAboutClosingTabSubtreeOf(tab)) {
    //  aEvent.stopPropagation();
    //  aEvent.preventDefault();
    //  return;
    //}
    removeTabInternally(tab, { inRemote: true });
    return;
  }
}

function handleNewTabAction(aEvent, aOptions = {}) {
  if (configs.logOnMouseEvent)
    log('handleNewTabAction');
  var parent, insertBefore, insertAfter;
  if (configs.autoAttach) {
    let current = getCurrentTab(gTargetWindow);
    switch (aOptions.action) {
      case kNEWTAB_DO_NOTHING:
      case kNEWTAB_OPEN_AS_ORPHAN:
      default:
        break;

      case kNEWTAB_OPEN_AS_CHILD: {
        parent = current;
        let refTabs = getReferenceTabsForNewChild(parent);
        insertBefore = refTabs.insertBefore;
        insertAfter  = refTabs.insertAfter;
        if (configs.logOnMouseEvent)
          log('detected reference tabs: ',
              dumpTab(parent), dumpTab(insertBefore), dumpTab(insertAfter));
      }; break;

      case kNEWTAB_OPEN_AS_SIBLING:
        parent      = getParentTab(current);
        insertAfter = getLastDescendantTab(parent);
        break;

      case kNEWTAB_OPEN_AS_NEXT_SIBLING: {
        parent       = getParentTab(current);
        insertBefore = getNextSiblingTab(current);
        insertAfter  = getLastDescendantTab(current);
      }; break;
    }
  }
  if (parent &&
      configs.inheritContextualIdentityToNewChildTab &&
      !aOptions.cookieStoreId)
    aOptions.cookieStoreId = parent.apiTab.cookieStoreId;
  openNewTab({
    parent, insertBefore, insertAfter,
    inBackground:  aEvent.shiftKey,
    cookieStoreId: aOptions.cookieStoreId,
    inRemote:      true
  });
}

function onDblClick(aEvent) {
  if (isEventFiredOnNewTabButton(aEvent))
    return;

  var tab = getTabFromEvent(aEvent);
  if (tab) {
    if (configs.collapseExpandSubtreeByDblClick) {
      aEvent.stopPropagation();
      aEvent.preventDefault();
      collapseExpandSubtree(tab, {
        collapsed:       !isSubtreeCollapsed(tab),
        manualOperation: true,
        inRemote:        true
      });
    }
    return;
  }

  aEvent.stopPropagation();
  aEvent.preventDefault();
  handleNewTabAction(aEvent, {
    action: configs.autoAttachOnNewTabCommand
  });
}

function onTransisionEnd() {
  reserveToUpdateTabbarLayout({
    reason: kTABBAR_UPDATE_REASON_ANIMATION_END
  });
}

function onChange(aEvent) {
  var selector = aEvent.target;

  handleNewTabAction(aEvent, {
    cookieStoreId: selector.value
  });

  selector.value = '';
}

async function onWheel(aEvent) {
  if (!configs.zoomable &&
      isAccelKeyPressed(aEvent)) {
    aEvent.preventDefault();
    return;
  }

  var lockers = Object.keys(gScrollLockedBy);
  if (lockers.length <= 0)
    return;

  aEvent.stopImmediatePropagation();
  aEvent.preventDefault();

  var tab = getTabFromEvent(aEvent);
  var results = await sendTSTAPIMessage({
    type:      kTSTAPI_NOTIFY_SCROLLED,
    tab:       tab && serializeTabForTSTAPI(tab),
    tabs:      getTabs().map(serializeTabForTSTAPI),
    window:    gTargetWindow,

    deltaY:       aEvent.deltaY,
    deltaMode:    aEvent.deltaMode,
    scrollTop:    gTabBar.scrollTop,
    scrollTopMax: gTabBar.scrollTopMax,

    altKey:    aEvent.altKey,
    ctrlKey:   aEvent.ctrlKey,
    metaKey:   aEvent.metaKey,
    shiftKey:  aEvent.shiftKey,

    clientX:   aEvent.clientX,
    clientY:   aEvent.clientY
  }, {
    targets: lockers
  });
  for (let result of results) {
    if (result.error || result.result === undefined)
      delete gScrollLockedBy[result.id];
  }
}

function onScroll(aEvent) {
  reserveToSaveScrollPosition();
}

function reserveToSaveScrollPosition() {
  if (reserveToSaveScrollPosition.reserved)
    clearTimeout(reserveToSaveScrollPosition.reserved);
  reserveToSaveScrollPosition.reserved = setTimeout(() => {
    delete reserveToSaveScrollPosition.reserved;
    browser.sessions.setWindowValue(
      gTargetWindow,
      kWINDOW_STATE_SCROLL_POSITION,
      gTabBar.scrollTop
    );
  }, 150);
}


/* raw event handlers */

function onTabBuilt(aTab, aInfo) {
  var label = getTabLabel(aTab);

  var twisty = document.createElement('span');
  twisty.classList.add(kTWISTY);
  twisty.setAttribute('title', browser.i18n.getMessage('tab.twisty.collapsed.tooltip'));
  aTab.insertBefore(twisty, label);

  var favicon = document.createElement('span');
  favicon.classList.add(kFAVICON);
  var faviconImage = favicon.appendChild(document.createElement('img'));
  faviconImage.classList.add(kFAVICON_IMAGE);
  var defaultIcon = favicon.appendChild(document.createElement('span'));
  defaultIcon.classList.add(kFAVICON_DEFAULT);
  var throbber = favicon.appendChild(document.createElement('span'));
  throbber.classList.add(kTHROBBER);
  aTab.insertBefore(favicon, label);

  var counter = document.createElement('span');
  counter.classList.add(kCOUNTER);
  aTab.appendChild(counter);

  var soundButton = document.createElement('button');
  soundButton.classList.add(kSOUND_BUTTON);
  aTab.appendChild(soundButton);

  var closebox = document.createElement('span');
  closebox.classList.add(kCLOSEBOX);
  closebox.setAttribute('title', browser.i18n.getMessage('tab.closebox.tab.tooltip'));
  closebox.setAttribute('draggable', true); // this is required to cancel click by dragging
  aTab.appendChild(closebox);

  var burster = document.createElement('span');
  burster.classList.add(kBURSTER);
  aTab.appendChild(burster);

  var activeMarker = document.createElement('span');
  activeMarker.classList.add(kACTIVE_MARKER);
  aTab.appendChild(activeMarker);

  var identityMarker = document.createElement('span');
  identityMarker.classList.add(kCONTEXTUAL_IDENTITY_MARKER);
  aTab.appendChild(identityMarker);

  var extraItemsContainerBehind = document.createElement('span');
  extraItemsContainerBehind.classList.add(kEXTRA_ITEMS_CONTAINER);
  extraItemsContainerBehind.classList.add('behind');
  aTab.appendChild(extraItemsContainerBehind);

  aTab.setAttribute('draggable', true);

  if (!aInfo.existing && configs.animation) {
    collapseExpandTab(aTab, {
      collapsed: true,
      justNow:   true
    });
  }
}


function onTabFaviconUpdated(aTab, aURL) {
  TabFavIconHelper.loadToImage({
    image: getTabFavicon(aTab).firstChild,
    tab:   aTab.apiTab,
    url:   aURL
  });
  markWindowCacheDirty(kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
}

function onTabUpdated(aTab, aChangeInfo) {
  updateTabSoundButtonTooltip(aTab);
  markWindowCacheDirty(kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
}

function onTabLabelUpdated(aTab) {
  reserveToUpdateTabTooltip(aTab);
  markWindowCacheDirty(kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
}

function onParentTabUpdated(aTab) {
  updateTabSoundButtonTooltip(aTab);
  markWindowCacheDirty(kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
}

function updateTabSoundButtonTooltip(aTab) {
  var tooltip = '';
  if (maybeMuted(aTab))
    tooltip = browser.i18n.getMessage('tab.soundButton.muted.tooltip');
  else if (maybeSoundPlaying(aTab))
    tooltip = browser.i18n.getMessage('tab.soundButton.playing.tooltip');

  getTabSoundButton(aTab).setAttribute('title', tooltip);
  markWindowCacheDirty(kWINDOW_STATE_CACHED_SIDEBAR_TABS_DIRTY);
}

function onTabFocused(aTab) {
  tabContextMenu.close();
  scrollToTab(aTab);
}

function onTabOpening(aTab, aInfo = {}) {
  tabContextMenu.close();
}

function onTabOpened(aTab, aInfo = {}) {
  if (configs.animation) {
    aTab.classList.add(kTAB_STATE_ANIMATION_READY);
    nextFrame().then(() => {
      var parent = getParentTab(aTab);
      if (parent && isSubtreeCollapsed(parent)) // possibly collapsed by other trigger intentionally
        return;
      var focused = isActive(aTab);
      collapseExpandTab(aTab, {
        collapsed: false,
        justNow:   gRestoringTree,
        anchor:    getCurrentTab(),
        last:      true
      });
      if (!focused)
        notifyOutOfViewTab(aTab);
    });
  }
  else {
    aTab.classList.add(kTAB_STATE_ANIMATION_READY);
    if (isActive(aTab))
      scrollToNewTab(aTab);
    else
      notifyOutOfViewTab(aTab);
  }

  reserveToUpdateVisualMaxTreeLevel();
  reserveToUpdateTabbarLayout({
    reason:  kTABBAR_UPDATE_REASON_TAB_OPEN,
    timeout: configs.collapseDuration
  });
  reserveToUpdateCachedTabbar();
}

function onTabRestoring(aTab) {
  if (!configs.useCachedTree) // we cannot know when we should unblock on no cache case...
    return;

  var container = aTab.parentNode;
  // When we are restoring two or more tabs.
  // (But we don't need do this again for third, fourth, and later tabs.)
  if (container.restoredCount == 2)
    blockUserOperations({ throbber: true });
}

// Tree restoration for "Restore Previous Session"
async function onWindowRestoring(aWindowId) {
  if (!configs.useCachedTree)
    return;

  log('onWindowRestoring');
  var container = getTabsContainer(aWindowId);
  var restoredCount = await container.allTabsRestored;
  if (restoredCount == 1) {
    log('onWindowRestoring: single tab restored');
    unblockUserOperations({ throbber: true });
    return;
  }

  log('onWindowRestoring: continue');
  var cache = await getEffectiveWindowCache({
    ignorePinnedTabs: true
  });
  if (!cache ||
      (cache.offset &&
       container.childNodes.length <= cache.offset)) {
    log('onWindowRestoring: no effective cache');
    await inheritTreeStructure(); // fallback to classic method
    unblockUserOperations({ throbber: true });
    return;
  }

  log('onWindowRestoring restore! ', cache);
  gMetricsData.add('onWindowRestoring restore start');
  cache.tabbar.tabsDirty = true;
  var tabs = await browser.tabs.query({ windowId: aWindowId });
  restoreTabsFromCache(cache.tabbar, {
    offset: cache.offset || 0,
    tabs
  });
  updateVisualMaxTreeLevel();
  updateIndent({
    force: true,
    cache: cache.offset == 0 ? cache.indent : null
  });
  updateTabbarLayout({ justNow: true });
  unblockUserOperations({ throbber: true });
  gMetricsData.add('onWindowRestoring restore end');
}

function onTabClosed(aTab, aCloseInfo) {
  tabContextMenu.close();

  var closeParentBehavior = getCloseParentBehaviorForTabWithSidebarOpenState(aTab, aCloseInfo);
  if (closeParentBehavior != kCLOSE_PARENT_BEHAVIOR_CLOSE_ALL_CHILDREN &&
      isSubtreeCollapsed(aTab))
    collapseExpandSubtree(aTab, {
      collapsed: false
    });

  // We don't need to update children because they are controlled by bacgkround.
  // However we still need to update the parent itself.
  detachTab(aTab, {
    dontUpdateIndent: true
  });
  reserveToUpdateVisualMaxTreeLevel();
  reserveToUpdateTabbarLayout({
    reason:  kTABBAR_UPDATE_REASON_TAB_CLOSE,
    timeout: configs.collapseDuration
  });
  reserveToUpdateLoadingState();
}

async function onTabCompletelyClosed(aTab) {
  // "Restore Previous Session" closes some tabs at first, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
  wait(0).then(() => reserveToUpdateCachedTabbar());
  if (!configs.animation)
    return;

  return new Promise(async (aResolve, aReject) => {
    let tabRect = aTab.getBoundingClientRect();
    aTab.style.marginLeft = `${tabRect.width}px`;
    await wait(configs.animation ? configs.collapseDuration : 0);
    reserveToUpdateCachedTabbar();
    aResolve();
  });
}

function onTabMoving(aTab) {
  tabContextMenu.close();
  if (configs.animation &&
      !isCollapsed(aTab) &&
      !isPinned(aTab) &&
      !isOpening(aTab)) {
    aTab.classList.add(kTAB_STATE_MOVING);
    collapseExpandTab(aTab, {
      collapsed: true,
      justNow:   true
    });
    nextFrame().then(async () => {
      if (!ensureLivingTab(aTab)) // it was removed while waiting
        return;
      collapseExpandTab(aTab, {
        collapsed: false
      });
      await wait(configs.collapseDuration);
      aTab.classList.remove(kTAB_STATE_MOVING);
    });
  }
}

function onTabMoved(aTab) {
  reserveToUpdateTabbarLayout({
    reason:  kTABBAR_UPDATE_REASON_TAB_MOVE,
    timeout: configs.collapseDuration
  });
  reserveToUpdateTabTooltip(getParentTab(aTab));
  reserveToUpdateCachedTabbar();
}

async function onTabLevelChanged(aTab) {
  reserveToUpdateIndent();
  await wait(0);
  // "Restore Previous Session" closes some tabs at first and it causes tree changes, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
  reserveToUpdateCachedTabbar();
}

function onTabDetachedFromWindow(aTab) {
  if (!ensureLivingTab(aTab))
    return;
  reserveToUpdateTabTooltip(getParentTab(aTab));
  // We don't need to update children because they are controlled by bacgkround.
  // However we still need to update the parent itself.
  detachTab(aTab, {
    dontUpdateIndent: true
  });
  reserveToUpdateCachedTabbar();
}

function onTabSubtreeCollapsedStateChanging(aTab, aInfo = {}) {
  updateTabTwisty(aTab);
  updateTabClosebox(aTab);
  reserveToUpdateTabTooltip(aTab);
}

function onTabCollapsedStateChanging(aTab, aInfo = {}) {
  var toBeCollapsed = aInfo.collapsed;

  if (configs.logOnCollapseExpand)
    log('onTabCollapsedStateChanging ', dumpTab(aTab), aInfo);
  if (!ensureLivingTab(aTab)) // do nothing for closed tab!
    return;

  markWindowCacheDirty(kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);

  if (aTab.onEndCollapseExpandAnimation) {
    clearTimeout(aTab.onEndCollapseExpandAnimation.timeout);
    delete aTab.onEndCollapseExpandAnimation;
  }

  if (aTab.apiTab.status == 'loading')
    aTab.classList.add(kTAB_STATE_THROBBER_UNSYNCHRONIZED);

  if (aInfo.anchor && !isTabInViewport(aInfo.anchor))
    aInfo.anchor = null;

  var reason = toBeCollapsed ? kTABBAR_UPDATE_REASON_COLLAPSE : kTABBAR_UPDATE_REASON_EXPAND ;

  if (!configs.animation ||
      aInfo.justNow ||
      configs.collapseDuration < 1) {
    //log('=> skip animation');
    return;
  }

  if (toBeCollapsed) {
    aTab.classList.add(kTAB_STATE_COLLAPSING);
  }
  else {
    aTab.classList.add(kTAB_STATE_EXPANDING);
    aTab.classList.remove(kTAB_STATE_COLLAPSED_DONE);
  }

  reserveToUpdateTabbarLayout({ reason });

  nextFrame().then(() => {
    if (!ensureLivingTab(aTab)) // it was removed while waiting
      return;

    //log('start animation for ', dumpTab(aTab));
    if (aInfo.last)
      scrollToTab(aTab, {
        anchor:            aInfo.anchor,
        notifyOnOutOfView: true
      });

    aTab.onEndCollapseExpandAnimation = (() => {
      //log('=> finish animation for ', dumpTab(aTab));
      aTab.classList.remove(kTAB_STATE_COLLAPSING);
      aTab.classList.remove(kTAB_STATE_EXPANDING);

      // The collapsed state of the tab can be changed by different trigger,
      // so we must respect the actual status of the tab, instead of the
      // "expected status" given via arguments.
      if (aTab.classList.contains(kTAB_STATE_COLLAPSED))
        aTab.classList.add(kTAB_STATE_COLLAPSED_DONE);
      else
        aTab.classList.remove(kTAB_STATE_COLLAPSED_DONE);

      onEndCollapseExpandCompletely(aTab, {
        collapsed: toBeCollapsed,
        reason
      });
    });
    aTab.onEndCollapseExpandAnimation.timeout = setTimeout(() => {
      if (!ensureLivingTab(aTab) ||
          !aTab.onEndCollapseExpandAnimation)
        return;
      delete aTab.onEndCollapseExpandAnimation.timeout;
      aTab.onEndCollapseExpandAnimation();
      delete aTab.onEndCollapseExpandAnimation;
    }, configs.collapseDuration);
  });
}
function onEndCollapseExpandCompletely(aTab, aOptions = {}) {
  if (configs.indentAutoShrink &&
      configs.indentAutoShrinkOnlyForVisible)
    reserveToUpdateVisualMaxTreeLevel();

  reserveToUpdateLoadingState();

  // this is very required for no animation case!
  reserveToUpdateTabbarLayout({ reason: aOptions.reason });
  markWindowCacheDirty(kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);
}

function onTabCollapsedStateChanged(aTab, aInfo = {}) {
  var toBeCollapsed = aInfo.collapsed;
  if (!ensureLivingTab(aTab)) // do nothing for closed tab!
    return;

  reserveToUpdateLoadingState();
  markWindowCacheDirty(kWINDOW_STATE_CACHED_SIDEBAR_COLLAPSED_DIRTY);

  if (configs.animation &&
      !aInfo.justNow &&
      configs.collapseDuration > 0)
    return; // animation

  //log('=> skip animation');
  if (toBeCollapsed)
    aTab.classList.add(kTAB_STATE_COLLAPSED_DONE);
  else
    aTab.classList.remove(kTAB_STATE_COLLAPSED_DONE);


  var reason = toBeCollapsed ? kTABBAR_UPDATE_REASON_COLLAPSE : kTABBAR_UPDATE_REASON_EXPAND ;
  onEndCollapseExpandCompletely(aTab, {
    collapsed: toBeCollapsed,
    reason
  });

  if (aInfo.last)
    scrollToTab(aTab, {
      anchor:            aInfo.anchor,
      notifyOnOutOfView: true
    });
}


/*
function onTabSubtreeCollapsedStateChangedManually(aEvent) {
  if (!configs.indentAutoShrink ||
      !configs.indentAutoShrinkOnlyForVisible)
    return;

  cancelCheckTabsIndentOverflow();
  if (!aTab.checkTabsIndentOverflowOnMouseLeave) {
    let stillOver = false;
    let id = aTab.id
    aTab.checkTabsIndentOverflowOnMouseLeave = function checkTabsIndentOverflowOnMouseLeave(aEvent, aDelayed) {
      if (aEvent.type == 'mouseover') {
        if (evaluateXPath(
              `ancestor-or-self::*[#${id}]`,
              aEvent.originalTarget || aEvent.target,
              XPathResult.BOOLEAN_TYPE
            ).booleanValue)
            stillOver = true;
          return;
        }
        else if (!aDelayed) {
          if (stillOver) {
            stillOver = false;
          }
          setTimeout(() => {
            if (!ensureLivingTab(aTab)) // it was removed while waiting
              return;
            aTab.checkTabsIndentOverflowOnMouseLeave(aEvent, true);
          }, 0);
          return;
        } else if (stillOver) {
          return;
        }
        var x = aEvent.clientX;
        var y = aEvent.clientY;
        var rect = aTab.getBoundingClientRect();
        if (x > rect.left && x < rect.right && y > rect.top && y < rect.bottom)
          return;
        document.removeEventListener('mouseover', aTab.checkTabsIndentOverflowOnMouseLeave, true);
        document.removeEventListener('mouseout', aTab.checkTabsIndentOverflowOnMouseLeave, true);
        delete aTab.checkTabsIndentOverflowOnMouseLeave;
        checkTabsIndentOverflow();
      };
      document.addEventListener('mouseover', aTab.checkTabsIndentOverflowOnMouseLeave, true);
      document.addEventListener('mouseout', aTab.checkTabsIndentOverflowOnMouseLeave, true);
    }
  }
}
*/

async function onTabAttached(aTab, aInfo = {}) {
  if (gInitializing)
    return;
  tabContextMenu.close();
  updateTabTwisty(aInfo.parent);
  updateTabClosebox(aInfo.parent);
  if (aInfo.newlyAttached) {
    let ancestors = [aInfo.parent].concat(getAncestorTabs(aInfo.parent));
    for (let ancestor of ancestors) {
      updateTabsCount(ancestor);
    }
  }
  reserveToUpdateTabTooltip(aInfo.parent);
  reserveToUpdateVisualMaxTreeLevel();
  reserveToUpdateIndent();
  /*
    We must not scroll to the tab here, because the tab can be moved
    by the background page later. Instead we wait until the tab is
    successfully moved (then kCOMMAND_TAB_ATTACHED_COMPLETELY is delivered.)
  */

  await wait(0);
  // "Restore Previous Session" closes some tabs at first and it causes tree changes, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
  reserveToUpdateCachedTabbar();
}

async function onTabDetached(aTab, aDetachInfo = {}) {
  if (gInitializing)
    return;
  tabContextMenu.close();
  var parent = aDetachInfo.oldParentTab;
  if (!parent)
    return;
  updateTabTwisty(parent);
  updateTabClosebox(parent);
  reserveToUpdateVisualMaxTreeLevel();
  reserveToUpdateIndent();
  reserveToUpdateTabTooltip(parent);
  var ancestors = [parent].concat(getAncestorTabs(parent));
  for (let ancestor of ancestors) {
    updateTabsCount(ancestor);
  }

  await wait(0);
  // "Restore Previous Session" closes some tabs at first and it causes tree changes, so we should not clear the old cache yet.
  // See also: https://dxr.mozilla.org/mozilla-central/rev/5be384bcf00191f97d32b4ac3ecd1b85ec7b18e1/browser/components/sessionstore/SessionStore.jsm#3053
  reserveToUpdateCachedTabbar();
}

function onTabPinned(aTab) {
  tabContextMenu.close();
  reserveToPositionPinnedTabs();
  reserveToUpdateCachedTabbar();
}

function onTabUnpinned(aTab) {
  tabContextMenu.close();
  clearPinnedStyle(aTab);
  scrollToTab(aTab);
  //updateInvertedTabContentsOrder(aTab);
  reserveToPositionPinnedTabs();
  reserveToUpdateCachedTabbar();
}

function onTabStateChanged(aTab) {
  if (aTab.apiTab.status == 'loading')
    aTab.classList.add(kTAB_STATE_THROBBER_UNSYNCHRONIZED);
  else
    aTab.classList.remove(kTAB_STATE_THROBBER_UNSYNCHRONIZED);

  reserveToUpdateLoadingState();
}

function onContextualIdentitiesUpdated() {
  updateContextualIdentitiesStyle();
  updateContextualIdentitiesSelector();
}


/* message observer */

function onMessage(aMessage, aSender, aRespond) {
  if (!aMessage ||
      typeof aMessage.type != 'string' ||
      aMessage.type.indexOf('treestyletab:') != 0)
    return;

  //log('onMessage: ', aMessage, aSender);
  switch (aMessage.type) {
    case kCOMMAND_PING_TO_SIDEBAR: {
      if (aMessage.windowId == gTargetWindow)
        return Promise.resolve(true);
    }; break;

    case kCOMMAND_PUSH_TREE_STRUCTURE:
      if (aMessage.windowId == gTargetWindow)
        applyTreeStructureToTabs(getAllTabs(gTargetWindow), aMessage.structure);
      break;

    case kCOMMAND_NOTIFY_TAB_RESTORING:
      gRestoringTabCount++;
      break;

    case kCOMMAND_NOTIFY_TAB_RESTORED:
      gRestoringTabCount--;
      break;

    case kCOMMAND_CHANGE_SUBTREE_COLLAPSED_STATE: {
      if (aMessage.windowId == gTargetWindow) return (async () => {
        await waitUntilTabsAreaCreated(aMessage.tab);
        let tab = getTabById(aMessage.tab);
        if (!tab)
          return;
        let params = {
          collapsed: aMessage.collapsed,
          justNow:   aMessage.justNow,
          stack:     aMessage.stack
        };
        if (aMessage.manualOperation)
          manualCollapseExpandSubtree(tab, params);
        else
          collapseExpandSubtree(tab, params);
      })();
    }; break;

    case kCOMMAND_CHANGE_TAB_COLLAPSED_STATE: {
      if (aMessage.windowId == gTargetWindow) return (async () => {
        await waitUntilTabsAreaCreated(aMessage.tab);
        let tab = getTabById(aMessage.tab);
        if (!tab)
          return;
        // Tree's collapsed state can be changed before this message is delivered,
        // so we should ignore obsolete messages.
        if (aMessage.byAncestor &&
            aMessage.collapsed != getAncestorTabs(tab).some(isSubtreeCollapsed))
          return;
        let params = {
          collapsed:   aMessage.collapsed,
          justNow:     aMessage.justNow,
          broadcasted: true,
          stack:       aMessage.stack
        };
        collapseExpandTab(tab, params);
      })();
    }; break;

    case kCOMMAND_MOVE_TABS_BEFORE:
      return (async () => {
        await waitUntilTabsAreaCreated(aMessage.tabs.concat([aMessage.nextTab]));
        return moveTabsBefore(
          aMessage.tabs.map(getTabById),
          getTabById(aMessage.nextTab),
          aMessage
        ).then(aTabs => aTabs.map(aTab => aTab.id));
      })();

    case kCOMMAND_MOVE_TABS_AFTER:
      return (async () => {
        await waitUntilTabsAreaCreated(aMessage.tabs.concat([aMessage.previousTab]));
        return moveTabsAfter(
          aMessage.tabs.map(getTabById),
          getTabById(aMessage.previousTab),
          aMessage
        ).then(aTabs => aTabs.map(aTab => aTab.id));
      })();

    case kCOMMAND_REMOVE_TABS_INTERNALLY:
      return (async () => {
        await waitUntilTabsAreaCreated(aMessage.tabs);
        return removeTabsInternally(aMessage.tabs.map(getTabById), aMessage.options);
      })();

    case kCOMMAND_ATTACH_TAB_TO: {
      if (aMessage.windowId == gTargetWindow) return (async () => {
        await waitUntilTabsAreaCreated([
          aMessage.child,
          aMessage.parent,
          aMessage.insertBefore,
          aMessage.insertAfter
        ]);
        log('attach tab from remote ', aMessage);
        let child  = getTabById(aMessage.child);
        let parent = getTabById(aMessage.parent);
        if (child && parent)
          attachTabTo(child, parent, Object.assign({}, aMessage, {
            insertBefore: getTabById(aMessage.insertBefore),
            insertAfter:  getTabById(aMessage.insertAfter),
            inRemote:     false,
            broadcast:    false
          }));
      })();
    }; break;

    case kCOMMAND_TAB_ATTACHED_COMPLETELY:
      return (async () => {
        await waitUntilTabsAreaCreated([
          aMessage.tab,
          aMessage.parent
        ]);
        let tab = getTabById(aMessage.tab);
        if (tab && isActive(getTabById(aMessage.parent)))
          scrollToNewTab(tab);
      })();

    case kCOMMAND_DETACH_TAB: {
      if (aMessage.windowId == gTargetWindow) return (async () => {
        await waitUntilTabsAreaCreated(aMessage.tab);
        let tab = getTabById(aMessage.tab);
        if (tab)
          detachTab(tab, aMessage);
      })();
    }; break;

    case kCOMMAND_BLOCK_USER_OPERATIONS: {
      if (aMessage.windowId == gTargetWindow)
        blockUserOperationsIn(gTargetWindow, aMessage);
    }; break;

    case kCOMMAND_UNBLOCK_USER_OPERATIONS: {
      if (aMessage.windowId == gTargetWindow)
        unblockUserOperationsIn(gTargetWindow, aMessage);
    }; break;

    case kCOMMAND_BROADCAST_TAB_STATE: {
      if (!aMessage.tabs.length)
        break;
      return (async () => {
        await waitUntilTabsAreaCreated(aMessage.tabs);
        let add    = aMessage.add || [];
        let remove = aMessage.remove || [];
        log('apply broadcasted tab state ', aMessage.tabs, {
          add:    add.join(','),
          remove: remove.join(',')
        });
        let modified = add.concat(remove);
        for (let tab of aMessage.tabs) {
          tab = getTabById(tab);
          if (!tab)
            continue;
          add.forEach(aState => tab.classList.add(aState));
          remove.forEach(aState => tab.classList.remove(aState));
          if (modified.indexOf(kTAB_STATE_AUDIBLE) > -1 ||
            modified.indexOf(kTAB_STATE_SOUND_PLAYING) > -1 ||
            modified.indexOf(kTAB_STATE_MUTED) > -1) {
            updateTabSoundButtonTooltip(tab);
            if (aMessage.bubbles)
              updateParentTab(getParentTab(tab));
          }
        }
      })();
    }; break;
  }
}

function onMessageExternal(aMessage, aSender) {
  switch (aMessage.type) {
    case kTSTAPI_REGISTER_SELF: {
      if (aMessage.style)
        installStyleForAddon(aSender.id, aMessage.style)
    }; break;

    case kTSTAPI_UNREGISTER_SELF: {
      uninstallStyleForAddon(aSender.id)
      delete gScrollLockedBy[aSender.id];
    }; break;

    case kTSTAPI_SCROLL_LOCK:
      gScrollLockedBy[aSender.id] = true;
      return Promise.resolve(true);

    case kTSTAPI_SCROLL_UNLOCK:
      delete gScrollLockedBy[aSender.id];
      return Promise.resolve(true);

    case kTSTAPI_SCROLL:
      return (async () => {
        let params = {};
        if ('tab' in aMessage) {
          await waitUntilTabsAreaCreated(aMessage.tab);
          params.tab = getTabById(aMessage.tab);
          if (!params.tab || params.tab.windowId != gTargetWindow)
            return;
        }
        else {
          if (aMessage.window != gTargetWindow)
            return;
          if ('delta' in aMessage)
            params.delta = aMessage.delta;
          if ('position' in aMessage)
            params.position = aMessage.position;
        }
        return scrollTo(params).then(() => {
          return true;
        });
      })();
  }
}

function onBrowserThemeChanged(aUpdateInfo) {
  if (!aUpdateInfo.windowId || // reset to default
      aUpdateInfo.windowId == gTargetWindow)
    applyBrowserTheme(aUpdateInfo.theme);
}

function onConfigChange(aChangedKey) {
  var rootClasses = document.documentElement.classList;
  switch (aChangedKey) {
    case 'debug': {
      for (let tab of getAllTabs()) {
        updateTab(tab, tab.apiTab, { forceApply: true });
      }
      if (configs.debug)
        rootClasses.add('debug');
      else
        rootClasses.remove('debug');
    }; break;

    case 'animation':
      if (configs.animation)
        rootClasses.add('animation');
      else
        rootClasses.remove('animation');
      break;

    case 'sidebarPosition':
      if (configs.sidebarPosition == kTABBAR_POSITION_RIGHT) {
        rootClasses.add('right');
        rootClasses.remove('left');
        gIndentProp = 'margin-right';
      }
      else {
        rootClasses.add('left');
        rootClasses.remove('right');
        gIndentProp = 'margin-left';
      }
      updateIndent({ force: true });
      break;

    case 'baseIndent':
    case 'minIndent':
    case 'maxTreeLevel':
    case 'indentAutoShrink':
    case 'indentAutoShrinkOnlyForVisible':
      updateIndent({ force: true });
      break;

    case 'style':
      location.reload();
      break;

    case 'faviconizePinnedTabs':
      reserveToPositionPinnedTabs();
      break;

    case 'scrollbarMode':
      rootClasses.remove(kTABBAR_STATE_NARROW_SCROLLBAR);
      rootClasses.remove(kTABBAR_STATE_NO_SCROLLBAR);
      rootClasses.remove(kTABBAR_STATE_OVERLAY_SCROLLBAR);
      switch (configs.scrollbarMode) {
        default:
        case kTABBAR_SCROLLBAR_MODE_DEFAULT:
          break;
        case kTABBAR_SCROLLBAR_MODE_NARROW:
          rootClasses.add(kTABBAR_STATE_NARROW_SCROLLBAR);
          break;
        case kTABBAR_SCROLLBAR_MODE_HIDE:
          rootClasses.add(kTABBAR_STATE_NO_SCROLLBAR);
          break;
        case kTABBAR_SCROLLBAR_MODE_OVERLAY:
          rootClasses.add(kTABBAR_STATE_OVERLAY_SCROLLBAR);
          break;
      }
      break;

    case 'colorScheme':
      document.documentElement.setAttribute('color-scheme', configs.colorScheme);
      break;

    case 'narrowScrollbarSize':
      location.reload();
      break;

    case 'userStyleRules':
      applyUserStyleRules()
      break;

    case 'inheritContextualIdentityToNewChildTab':
      updateContextualIdentitiesSelector();
      break;

    case 'showContextualIdentitiesSelector':
      if (configs[aChangedKey])
        rootClasses.add(kTABBAR_STATE_CONTEXTUAL_IDENTITY_SELECTABLE);
      else
        rootClasses.remove(kTABBAR_STATE_CONTEXTUAL_IDENTITY_SELECTABLE);
      break;

    case 'useCachedTree':
      if (configs[aChangedKey])
        reserveToUpdateCachedTabbar();
      else
        clearWindowCache().then(() => location.reload());
      break;

    case 'simulateSVGContextFill':
      if (configs[aChangedKey])
        rootClasses.add('simulate-svg-context-fill');
      else
        rootClasses.remove('simulate-svg-context-fill');
      break;
  }
}
