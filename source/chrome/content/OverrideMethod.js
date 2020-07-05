/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.OverrideMethod = function()
{
  try
  {
    var toolbox = document.getElementById("navigator-toolbox");
    // Object.prototype.watch() shim, based on Eli Grey's polyfill object.watch
    if (!toolbox.watch)
    {
      Object.defineProperty(toolbox, "watch",
      {
        enumerable: false,
        configurable: true,
        writable: false,
        value: function(prop, handler)
        {
          var oldval = this[prop],
            newval = oldval,
            getter = function()
            {
              return newval;
            },
            setter = function(val)
            {
              oldval = newval;
              return newval = handler.call(this, prop, oldval, val);
            };

          try
          {
            if (delete this[prop])
            { // can't watch constants
              Object.defineProperty(this, prop,
              {
                get: getter,
                set: setter,
                enumerable: true,
                configurable: true
              });
            }
          }
          catch (e)
          {
            // This fails fatally on non-configurable props, so just
            // ignore errors if it does.
          }
        }
      });
    }
    toolbox.watch("customizing", this.toolboxCustomizeChange);
    if (!("tabBarWidthChange" in window) && !("TabmixTabbar" in window))
    {
      var tabBar = TabGroupsManager.utils.getElementByIdAndAnonids("content", "tabcontainer", "arrowscrollbox");
      if (tabBar)
      {
        tabBar.ensureElementIsVisible = tabBar.ensureElementIsVisible.toSource()
          .replace("element.getBoundingClientRect();", "TabGroupsManager.overrideMethod.getBoundingClientRectIfElementHidden( element )");
        //eval("tabBar.ensureElementIsVisible = "+tabBar.ensureElementIsVisible.toSource()
        //  .replace("element.getBoundingClientRect();","TabGroupsManager.overrideMethod.getBoundingClientRectIfElementHidden( element );")
        //);

        tabBar._elementFromPoint = tabBar._elementFromPoint.toSource()
          .replace(/(elements\[[^\]]+\]|element)\.getBoundingClientRect\(\)/g, "TabGroupsManager.overrideMethod.getBoundingClientRectIfElementHidden( $1 )");
        //eval("tabBar._elementFromPoint = "+tabBar._elementFromPoint.toSource()
        //  .replace(/(elements\[[^\]]+\]|element)\.getBoundingClientRect\(\)/g,"TabGroupsManager.overrideMethod.getBoundingClientRectIfElementHidden( $1 )")
        //);
      }
    }
    if ("TabmixSessionManager" in window)
    {
      TabmixSessionManager.loadOneWindow = TabmixSessionManager.loadOneWindow.toSource()
        .replace("TabGroupsManagerJsm.applicationStatus.makeNewId()", "group.id");
      //eval("TabmixSessionManager.loadOneWindow = "+TabmixSessionManager.loadOneWindow.toSource()
      //  .replace("TabGroupsManagerJsm.applicationStatus.makeNewId()","group.id")
      //);
    }
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.OverrideMethod.prototype.delayOverride = function()
{
  this.setOverride();
  if (TabGroupsManager.preferences.openNewGroupOperation)
  {
    this.setOverrideForNewGroup();
  }
};

TabGroupsManager.OverrideMethod.prototype.setOverride = function()
{
  if (gBrowser.tabContainer._handleTabDrag)
  {
    this.bakup_handleTabDrag = gBrowser.tabContainer._handleTabDrag;
    this.bakup_handleTabDrop = gBrowser.tabContainer._handleTabDrop;
    gBrowser.tabContainer._handleTabDrag = this.override_handleTabDrag;
    gBrowser.tabContainer._handleTabDrop = this.override_handleTabDrop;
  }
  document.getElementById("TabGroupsManagerGroupBarScrollbox").scrollByIndex = this.arrowScrollBoxScrollByIndex;
  if (TabGroupsManager.preferences.tabTreeAnalysis)
  {
    this.backup_window_handleLinkClick = window.handleLinkClick;
    window.handleLinkClick = this.override_window_handleLinkClick;
    this.backup_nsBrowserAccess_prototype_openURI = nsBrowserAccess.prototype.openURI;
    nsBrowserAccess.prototype.openURI = this.override_nsBrowserAccess_prototype_openURI;
  }
  this.backup_window_canQuitApplication = window.canQuitApplication;
  window.canQuitApplication = this.override_window_canQuitApplication;
  this.backup_WindowIsClosing = WindowIsClosing;
  window.WindowIsClosing = this.override_WindowIsClosing;
  this.backup_gBrowser_removeTab = gBrowser.removeTab;
  gBrowser.removeTab = this.override_gBrowser_removeTab;
  if ("swapBrowsersAndCloseOther" in gBrowser)
  {
    this.backup_gBrowser_swapBrowsersAndCloseOther = gBrowser.swapBrowsersAndCloseOther;
    gBrowser.swapBrowsersAndCloseOther = this.override_gBrowser_swapBrowsersAndCloseOther;
  }
  if ("_beginRemoveTab" in gBrowser)
  {
    this.backup_gBrowser__beginRemoveTab = gBrowser._beginRemoveTab;
    gBrowser._beginRemoveTab = this.override_gBrowser__beginRemoveTab;
  }
  if ("_endRemoveTab" in gBrowser)
  {
    this.backup_gBrowser__endRemoveTab = gBrowser._endRemoveTab;
    gBrowser._endRemoveTab = this.override_gBrowser__endRemoveTab;
  }
  if ("TabView" in window)
  {
    if (TabView._tabShowEventListener)
    {
      gBrowser.tabContainer.removeEventListener("TabShow", TabView._tabShowEventListener, true);
    }
  }
};

TabGroupsManager.OverrideMethod.prototype.setOverrideForNewGroup = function()
{
  this.backup_gBrowser_addTab = gBrowser.addTab;
  gBrowser.addTab = this.override_gBrowser_addTab;
  this.backup_gBrowser_loadOneTab = gBrowser.loadOneTab;
  gBrowser.loadOneTab = this.override_gBrowser_loadOneTab;
  this.backup_gBrowser_loadURI = gBrowser.loadURI;
  gBrowser.loadURI = this.override_gBrowser_loadURI;
  this.backup_gBrowser_loadURIWithFlags = gBrowser.loadURIWithFlags;
  gBrowser.loadURIWithFlags = this.override_gBrowser_loadURIWithFlags;
  this.backup_window_openUILinkIn = window.openUILinkIn;
  window.openUILinkIn = this.override_window_openUILinkIn;
  var searchBar = document.getElementById("searchbar");
  if (searchBar)
  {
    this.backup_searchbar_handleSearchCommand = searchBar.handleSearchCommand;
    searchBar.handleSearchCommand = this.override_searchbar_handleSearchCommand;
  }
};

TabGroupsManager.OverrideMethod.prototype.parseReferrerURI = function(arg, aCharset, aPostData)
{
  if (arg.length == 2 && typeof arg[1] == "object" && !(arg[1] instanceof Ci.nsIURI))
  {
    aCharset = arg[1].charset;
    aPostData = arg[1].postData;
  }
  return [aCharset, aPostData];
};

TabGroupsManager.OverrideMethod.prototype.gBrowserAddTab = function()
{
  if (this.backup_gBrowser_addTab)
  {
    return this.backup_gBrowser_addTab.apply(gBrowser, arguments);
  }
  else
  {
    return gBrowser.addTab.apply(gBrowser, arguments);
  }
};

TabGroupsManager.OverrideMethod.prototype.override_handleTabDrag = function(event)
{
  var draggedTab = this.draggedTab;
  if (!draggedTab)
  {
    return;
  }
  if (event)
  {
    draggedTab._dragData._savedEvent = event;
  }
  else
  {
    event = draggedTab._dragData._savedEvent;
  }
  let groupBarBox = TabGroupsManager.xulElements.groupBar.boxObject;
  let x1 = groupBarBox.screenX;
  let y1 = groupBarBox.screenY;
  let x2 = x1 + groupBarBox.width;
  let y2 = y1 + groupBarBox.height;
  if (x1 <= event.screenX && event.screenX <= x2 && y1 <= event.screenY && event.screenY <= y2)
  {
    event.dataTransfer = {};
    event.dataTransfer.types = {};
    event.dataTransfer.types.contains = function(item)
    {
      return item == "application/x-moz-tabbrowser-tab" || item == "text/x-moz-text-internal";
    };
    let parentChild = event.target.compareDocumentPosition(TabGroupsManager.xulElements.groupTabs);
    if (parentChild == 0 || parentChild == 10)
    {
      TabGroupsManager.groupDnDObserver.onDragOver(event, draggedTab);
    }
    else
    {
      TabGroupsManager.groupBarDnDObserver.onDragOver(event, draggedTab);
    }
    let dragPanel = this._tabDragPanel;
    if (!dragPanel.hidden)
    {
      let width = dragPanel.clientWidth;
      let [left, top] = this._getAdjustedCoords(event.screenX, event.screenY, width, dragPanel.clientHeight, width / 2, -12, true);
      dragPanel.moveTo(left, top);
    }
    return;
  }
  TabGroupsManager.groupDnDObserver.onDragLeave(event);
  TabGroupsManager.groupBarDnDObserver.onDragLeave(event);
  return TabGroupsManager.overrideMethod.bakup_handleTabDrag.apply(this, arguments);
};

TabGroupsManager.OverrideMethod.prototype.override_handleTabDrop = function(event)
{
  let groupBarBox = TabGroupsManager.xulElements.groupBar.boxObject;
  let x1 = groupBarBox.screenX;
  let y1 = groupBarBox.screenY;
  let x2 = x1 + groupBarBox.width;
  let y2 = y1 + groupBarBox.height;
  if (x1 <= event.screenX && event.screenX <= x2 && y1 <= event.screenY && event.screenY <= y2)
  {
    event.dataTransfer = {};
    event.dataTransfer.types = {};
    event.dataTransfer.types.contains = function(item)
    {
      return item == "application/x-moz-tabbrowser-tab" || item == "text/x-moz-text-internal";
    };
    let parentChild = event.target.compareDocumentPosition(TabGroupsManager.xulElements.groupTabs);
    if (parentChild == 0 || parentChild == 10)
    {
      TabGroupsManager.groupDnDObserver.onDrop(event, this.draggedTab);
    }
    else
    {
      TabGroupsManager.groupBarDnDObserver.onDrop(event, this.draggedTab);
    }
    this._endTabDrag();
    return;
  }
  return TabGroupsManager.overrideMethod.bakup_handleTabDrop.apply(this, arguments);
};

TabGroupsManager.OverrideMethod.prototype.override_TabView__window_UI_showTabView = function(zoomOut)
{
  TabGroupsManager.forPanorama.onTabViewShow();
  return TabGroupsManager.overrideMethod.backup_TabView__window_UI_showTabView.apply(this, arguments);
};

TabGroupsManager.OverrideMethod.prototype.overrideTabViewFunctions = function()
{
  TabView._window.GroupItems._updateTabBar = function() {};
  TabView._window.UI._removeTabActionHandlers();
  TabGroupsManager.overrideMethod.backup_TabView__eventListeners_open = TabView._window.UI._eventListeners.open;
  TabGroupsManager.overrideMethod.backup_TabView__eventListeners_close = TabView._window.UI._eventListeners.close;
  TabGroupsManager.overrideMethod.backup_TabView__eventListeners_move = TabView._window.UI._eventListeners.move;
  TabGroupsManager.overrideMethod.backup_TabView__eventListeners_select = TabView._window.UI._eventListeners.select;
  TabGroupsManager.overrideMethod.backup_TabView__eventListeners_pinned = TabView._window.UI._eventListeners.pinned;
  TabGroupsManager.overrideMethod.backup_TabView__eventListeners_unpinned = TabView._window.UI._eventListeners.unpinned;
  TabView._window.UI._eventListeners.open = TabGroupsManager.overrideMethod.override_TabView__eventListeners_open;
  TabView._window.UI._eventListeners.close = TabGroupsManager.overrideMethod.override_TabView__eventListeners_close;
  TabView._window.UI._eventListeners.move = TabGroupsManager.overrideMethod.override_TabView__eventListeners_move;
  TabView._window.UI._eventListeners.select = TabGroupsManager.overrideMethod.override_TabView__eventListeners_select;
  TabView._window.UI._eventListeners.pinned = TabGroupsManager.overrideMethod.override_TabView__eventListeners_pinned;
  TabView._window.UI._eventListeners.unpinned = TabGroupsManager.overrideMethod.override_TabView__eventListeners_unpinned;
  for (let name in TabView._window.UI._eventListeners)
  {
    TabView._window.AllTabs.register(name, TabView._window.UI._eventListeners[name]);
  }
  TabGroupsManager.overrideMethod.backup_TabView__window_UI_showTabView = TabView._window.UI.showTabView;
  TabView._window.UI.showTabView = TabGroupsManager.overrideMethod.override_TabView__window_UI_showTabView;
};

TabGroupsManager.OverrideMethod.prototype.override_TabView__eventListeners_open = function(tab)
{
  if (TabView._window.UI.isTabViewVisible())
  {
    TabGroupsManager.overrideMethod.backup_TabView__eventListeners_open.apply(this, arguments);
  }
};

TabGroupsManager.OverrideMethod.prototype.override_TabView__eventListeners_close = function(tab)
{
  if (TabView._window.UI.isTabViewVisible())
  {
    TabGroupsManager.overrideMethod.backup_TabView__eventListeners_close.apply(this, arguments);
  }
};

TabGroupsManager.OverrideMethod.prototype.override_TabView__eventListeners_move = function(tab)
{
  if (TabView._window.UI.isTabViewVisible())
  {
    TabGroupsManager.overrideMethod.backup_TabView__eventListeners_move.apply(this, arguments);
  }
};

TabGroupsManager.OverrideMethod.prototype.override_TabView__eventListeners_select = function(tab)
{
  if (TabView._window.UI.isTabViewVisible())
  {
    TabGroupsManager.overrideMethod.backup_TabView__eventListeners_select.apply(this, arguments);
  }
};

TabGroupsManager.OverrideMethod.prototype.override_TabView__eventListeners_pinned = function(tab)
{
  if (TabView._window.UI.isTabViewVisible())
  {
    TabGroupsManager.overrideMethod.backup_TabView__eventListeners_pinned.apply(this, arguments);
  }
};

TabGroupsManager.OverrideMethod.prototype.override_TabView__eventListeners_unpinned = function(tab)
{
  if (TabView._window.UI.isTabViewVisible())
  {
    TabGroupsManager.overrideMethod.backup_TabView__eventListeners_unpinned.apply(this, arguments);
  }
};

TabGroupsManager.OverrideMethod.prototype.override_gBrowser__beginRemoveTab = function(aTab, aTabWillBeMoved, aCloseWindowWithLastTab, aCloseWindowFastpath)
{
  if (1 == (this.mTabs.length - this._removingTabs.length))
  {
    TabGroupsManager.allGroups.selectNextGroup();
  }
  return TabGroupsManager.overrideMethod.backup_gBrowser__beginRemoveTab.apply(this, arguments);
};

TabGroupsManager.OverrideMethod.prototype.override_gBrowser__endRemoveTab = function(args)
{
  if (args._endRemoveArgs)
  {
    args._endRemoveArgs[1] = false;
  }
  else
  {
    args[2] = false;
  }
  TabGroupsManager.overrideMethod.backup_gBrowser__endRemoveTab.apply(this, arguments);
};

TabGroupsManager.OverrideMethod.prototype.override_window_canQuitApplication = function()
{
  TabGroupsManagerJsm.quitApplicationObserver.inCanQuitApplication = true;
  let result = true;
  try
  {
    result = TabGroupsManager.overrideMethod.backup_window_canQuitApplication.apply(this, arguments);
    if (result)
    {
      TabGroupsManagerJsm.quitApplicationObserver.afterQuitApplicationRequested();
    }
  }
  finally
  {
    delete TabGroupsManagerJsm.quitApplicationObserver.inCanQuitApplication;
  }
  return result
};

TabGroupsManager.OverrideMethod.prototype.override_gBrowser_swapBrowsersAndCloseOther = function(aOurTab, aOtherTab)
{
  let tabGroupsManagerBackupProgressListener = aOurTab.group.progressListener;
  try
  {
    aOurTab.linkedBrowser.removeProgressListener(tabGroupsManagerBackupProgressListener);
  }
  catch (e)
  {}
  aOtherTab.TabGroupsManagerSwapBrowsersAndCloseOtherFlag = true;
  try
  {
    TabGroupsManager.overrideMethod.backup_gBrowser_swapBrowsersAndCloseOther.apply(this, arguments);
    aOurTab.linkedBrowser.webProgress.addProgressListener(tabGroupsManagerBackupProgressListener, Ci.nsIWebProgress.NOTIFY_STATE_NETWORK);
  }
  finally
  {
    delete aOtherTab.TabGroupsManagerSwapBrowsersAndCloseOtherFlag;
  }
};

TabGroupsManager.OverrideMethod.prototype.override_nsBrowserAccess_prototype_openURI = function(aURI, aOpener, aWhere, aContext)
{
  if (aContext != Ci.nsIBrowserDOMWindow.OPEN_EXTERNAL || aURI || aURI.schemeIs("chrome"))
  {
    let whereTmp = (aWhere == Ci.nsIBrowserDOMWindow.OPEN_DEFAULTWINDOW) ? gPrefService.getIntPref("browser.link.open_newwindow") : aWhere;
    if (whereTmp == Ci.nsIBrowserDOMWindow.OPEN_NEWTAB)
    {
      TabGroupsManager.tabOpenStatus.setOpenerData(aOpener, aContext);
    }
  }
  return TabGroupsManager.overrideMethod.backup_nsBrowserAccess_prototype_openURI.apply(this, arguments);
};

TabGroupsManager.OverrideMethod.prototype.override_window_handleLinkClick = function(event, href, linkNode)
{
  if (event.button != 2)
  {
    let where = whereToOpenLink(event);
    if (where != "current" && where != "save")
    {
      TabGroupsManager.tabOpenStatus.setOpenerData(event.target.ownerDocument.defaultView, null);
    }
  }
  return TabGroupsManager.overrideMethod.backup_window_handleLinkClick.apply(this, arguments);
};

TabGroupsManager.OverrideMethod.prototype.override_WindowIsClosing = function()
{
  return TabGroupsManager.overrideMethod.backup_WindowIsClosing.apply(this, arguments) && TabGroupsManager.overrideMethod.methodInWindowOnCloseForTGM();
};

TabGroupsManager.OverrideMethod.prototype.override_gBrowser_removeTab = function(aTab, aParams)
{
  if (!TabGroupsManager.overrideMethod.tabCloseDisableCheck(aTab))
  {
    TabGroupsManager.overrideMethod.backup_gBrowser_removeTab.apply(this, arguments);
  }
};

TabGroupsManager.OverrideMethod.prototype.override_gBrowser_addTab = function(aURI, aReferrerURI, aCharset, aPostData, aOwner, aAllowThirdPartyFixup)
{
  if (TabGroupsManager.preferences.openNewGroupByShift && TabGroupsManager.keyboardState.shiftKey)
  {
    let newTab = TabGroupsManager.overrideMethod.backup_gBrowser_addTab.apply(this, arguments);
    TabGroupsManager.allGroups.openNewGroup(newTab);
    return newTab;
  }
  return TabGroupsManager.overrideMethod.backup_gBrowser_addTab.apply(this, arguments);
};

TabGroupsManager.OverrideMethod.prototype.override_gBrowser_loadOneTab = function(aURI, aReferrerURI, aCharset, aPostData, aLoadInBackground, aAllowThirdPartyFixup)
{
  if (TabGroupsManager.preferences.openNewGroupByShift && TabGroupsManager.keyboardState.shiftKey)
  {
    let newTab = TabGroupsManager.overrideMethod.backup_gBrowser_addTab.call(this, aURI, aReferrerURI, aCharset, aPostData, undefined, aAllowThirdPartyFixup);
    TabGroupsManager.allGroups.openNewGroup(newTab);
    return newTab;
  }
  return TabGroupsManager.overrideMethod.backup_gBrowser_loadOneTab.apply(this, arguments);
};

TabGroupsManager.OverrideMethod.prototype.override_gBrowser_loadURI = function(aURI, aReferrerURI, aCharset)
{
  if (TabGroupsManager.preferences.openNewGroupByShift && TabGroupsManager.keyboardState.shiftKey)
  {
    let newTab = TabGroupsManager.overrideMethod.backup_gBrowser_addTab.call(this, aURI, aReferrerURI, aCharset);
    TabGroupsManager.allGroups.openNewGroup(newTab);
    return newTab;
  }
  return TabGroupsManager.overrideMethod.backup_gBrowser_loadURI.apply(this, arguments);
};

TabGroupsManager.OverrideMethod.prototype.override_gBrowser_loadURIWithFlags = function(aURI, aFlags, aReferrerURI, aCharset, aPostData)
{
  if (TabGroupsManager.preferences.openNewGroupByShift && TabGroupsManager.keyboardState.shiftKey)
  {
    let newTab = TabGroupsManager.overrideMethod.backup_gBrowser_addTab.call(this, aURI, aReferrerURI, aCharset, aPostData);
    TabGroupsManager.allGroups.openNewGroup(newTab);
    return newTab;
  }
  return TabGroupsManager.overrideMethod.backup_gBrowser_loadURIWithFlags.apply(this, arguments);
};

TabGroupsManager.OverrideMethod.prototype.override_window_openUILinkIn = function(url, where, allowThirdPartyFixup, postData, referrerUrl)
{
  if (TabGroupsManager.preferences.openNewGroupByShift && TabGroupsManager.keyboardState.shiftKey)
  {
    let newTab = TabGroupsManager.overrideMethod.backup_gBrowser_addTab.call(this, url, referrerUrl, undefined, postData);
    TabGroupsManager.allGroups.openNewGroup(newTab);
    return newTab;
  }
  return TabGroupsManager.overrideMethod.backup_window_openUILinkIn.apply(this, arguments);
};

TabGroupsManager.OverrideMethod.prototype.override_searchbar_handleSearchCommand = function(aEvent, aOverride)
{
  var engine = document.getElementById("searchbar").currentEngine;
  if (("getSecondSearch" in window) && aOverride)
  {
    var ss = window.getSecondSearch();
    engine = ss.selectedEngine || ss.getRecentEngines()[0];
    engine = ss.getSearchEngineFromName(engine.name);
  }
  TabGroupsManager.overrideMethod.backup_searchbar_handleSearchCommand.apply(this, arguments);
};

TabGroupsManager.OverrideMethod.prototype.tabCloseDisableCheck = function(aTab)
{
  try
  {
    if (!TabGroupsManagerJsm.privateBrowsing.enteringOrExiting &&
      aTab.group &&
      aTab.group.tabArray.length == 1
    )
    {
      if (TabGroupsManager.preferences.groupNotCloseWhenCloseAllTabsInGroup)
      {
        aTab.group.addTab(TabGroupsManager.overrideMethod.gBrowserAddTab("about:blank"));
        return false;
      }
      else if (gBrowser.mTabContainer.childNodes.length == 1)
      {
        if (TabGroupsManager.allGroups.childNodes.length > 1)
        {
          TabGroupsManager.allGroups.selectNextGroup();
        }
        else
        {
          if (TabGroupsManagerJsm.applicationStatus.windows.length > 1 && TabGroupsManagerJsm.globalPreferences.windowCloseWhenLastGroupClose)
          {
            window.close();
          }
          else if (TabGroupsManager.utils.isBlankTab(aTab))
          {
            return true;
          }
        }
      }
    }
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
  return false;
};

TabGroupsManager.OverrideMethod.prototype.methodInWindowOnCloseForTGM = function()
{
  if (TabGroupsManagerJsm.applicationStatus.windows.length <= 1)
  {
    TabGroupsManager.afterQuitApplicationRequested();
    return true;
  }
  if (TabGroupsManager.allGroups.childNodes.length == 1 && gBrowser.mTabContainer.childNodes.length == 1)
  {
    return true;
  }
  TabGroupsManagerJsm.saveData.backupByWindowClose();
  switch (TabGroupsManager.preferences.processWhenWindowClose)
  {
  case 0:
    if (TabGroupsManager.allGroups.listMoveGroup().length > 0)
    {
      var result = this.confirmWhenWindowClose();
      if (result == 0)
      {
        TabGroupsManager.allGroups.moveAllGroupsToMainWindow();
      }
      else
      {
        return (result == 2);
      }
    }
    return true;
  case 1:
    TabGroupsManager.allGroups.moveAllGroupsToMainWindow();
    return true;
  case 2:
    return true;
  }
  return true;
};

TabGroupsManager.OverrideMethod.prototype.arrowScrollBoxScrollByIndex = function(index)
{
  index = index / Math.abs(index) || 0;
  this.scrollByPixels(index * 100);
};

TabGroupsManager.OverrideMethod.prototype.confirmWhenWindowClose = function()
{
  var prompt = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
  var title = TabGroupsManager.strings.getString("DialogTitle");
  var check = {
    value: false
  };
  if ("swapBrowsersAndCloseOther" in gBrowser)
  {
    var flags = prompt.BUTTON_POS_0 * prompt.BUTTON_TITLE_YES + prompt.BUTTON_POS_1 * prompt.BUTTON_TITLE_CANCEL + prompt.BUTTON_POS_2 * prompt.BUTTON_TITLE_NO;
    var message = TabGroupsManager.strings.getString("ConfirmMessageWhenWindowClose");
    var checkMessage = TabGroupsManager.strings.getString("ConfirmCheckMessageWhenWindowClose");
    var result = prompt.confirmEx(null, title, message, flags, "", "", "", checkMessage, check);
    if (check.value && result != 1)
    {
      TabGroupsManager.preferences.prefBranch.setIntPref("processWhenWindowClose", (result == 0) ? 1 : 2);
    }
    return result;
  }
  else
  {
    var message = TabGroupsManager.strings.getString("ConfirmMessageWhenWindowClose30");
    var checkMessage = TabGroupsManager.strings.getString("ConfirmCheckMessageWhenWindowClose30");
    var result = prompt.confirmCheck(null, title, message, checkMessage, check);
    if (check.value && result)
    {
      TabGroupsManager.preferences.prefBranch.setIntPref("processWhenWindowClose", 2);
    }
    return result ? 2 : 1;
  }
};

TabGroupsManager.OverrideMethod.prototype.getBoundingClientRectIfElementHidden = function(element)
{
  if (element.hidden)
  {
    for (var newElement = element.nextSibling; newElement; newElement = newElement.nextSibling)
    {
      if (!newElement.hidden)
      {
        var rect = newElement.getBoundingClientRect();
        return {
          "left": rect.left,
          "right": rect.left
        };
      }
    }
    for (newElement = element.previousSibling; newElement; newElement = newElement.previousSibling)
    {
      if (!newElement.hidden)
      {
        var rect = newElement.getBoundingClientRect();
        return {
          "left": rect.right,
          "right": rect.right
        };
      }
    }
  }
  return element.getBoundingClientRect();
};

TabGroupsManager.OverrideMethod.prototype.toolboxCustomizeChange = function(id, oldval, newval)
{
  if (newval == false)
  {
    try
    {
      TabGroupsManager.preferences.setButtonType("TabGroupsManagerButtonSleep", TabGroupsManager.preferences.buttonSleepLClick);
      TabGroupsManager.preferences.setButtonType("TabGroupsManagerButtonClose", TabGroupsManager.preferences.buttonCloseLClick);
      TabGroupsManager.preferences.setButtonType("TabGroupsManagerButtonOpen", TabGroupsManager.preferences.buttonOpenLClick);
      TabGroupsManager.sleepingGroups.setSleepGroupsImage();
    }
    catch (e)
    {
      TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
    }
  }
};
