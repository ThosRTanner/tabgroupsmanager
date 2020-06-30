/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.EventListener = function ()
{
  this.groupSelecting = false;
  this.tabOpenTarget = null;
};

TabGroupsManager.EventListener.prototype.createEventListener = function ()
{
  var groupTabs = document.getElementById("TabGroupsManagerGroupbar");
  groupTabs.addEventListener("mousedown", this, true);
  groupTabs.addEventListener("click", this, false);
  groupTabs.addEventListener("dblclick", this, false);
  groupTabs.addEventListener("select", this, false);
  if (!("TMP_TabGroupsManager" in window))
  {
    gBrowser.tabContainer.addEventListener("TabOpen", this, false);
    gBrowser.tabContainer.addEventListener("TabClose", this, false);
  }
  gBrowser.tabContainer.addEventListener("TabSelect", this, false);
  gBrowser.tabContainer.addEventListener("TabMove", this, false);
  gBrowser.tabContainer.addEventListener("TabShow", this, false);
  gBrowser.tabContainer.addEventListener("TabHide", this, false);
  var contextMenu = document.getElementById("contentAreaContextMenu");
  if (contextMenu)
  {
    contextMenu.addEventListener("popupshowing", this, false);
  }
};

TabGroupsManager.EventListener.prototype.destroyEventListener = function ()
{
  var groupTabs = document.getElementById("TabGroupsManagerGroupbar");
  groupTabs.removeEventListener("mousedown", this, true);
  groupTabs.removeEventListener("click", this, false);
  groupTabs.removeEventListener("dblclick", this, false);
  groupTabs.removeEventListener("select", this, false);
  if (!("TMP_TabGroupsManager" in window))
  {
    gBrowser.tabContainer.removeEventListener("TabOpen", this, false);
    gBrowser.tabContainer.removeEventListener("TabClose", this, false);
  }
  gBrowser.tabContainer.removeEventListener("TabSelect", this, false);
  gBrowser.tabContainer.removeEventListener("TabMove", this, false);
  var contextMenu = document.getElementById("contentAreaContextMenu");
  if (contextMenu)
  {
    contextMenu.removeEventListener("popupshowing", this, false);
  }
};

TabGroupsManager.EventListener.prototype.handleEvent = function (event)
{
  switch (event.type)
  {
  case "mousedown":
    event.stopPropagation();
    break;
  case "click":
    this.onGroupClick(event);
    break;
  case "dblclick":
    this.onGroupDblClick(event);
    break;
  case "select":
    this.onGroupSelect(event);
    break;
  case "TabOpen":
    this.onTabOpen(event);
    break;
  case "TabClose":
    this.onTabClose(event);
    break;
  case "TabSelect":
    this.onTabSelect(event);
    break;
  case "TabMove":
    this.onTabMove(event);
    break;
  case "TabShow":
    this.onTabShow(event);
    break;
  case "TabHide":
    this.onTabHide(event);
    break;
  case "popupshowing":
    this.contentAreaContextMenuShowHideItems(event);
    break;
  }
};

TabGroupsManager.EventListener.prototype.onTabOpen = function (event)
{
  try
  {
    if (!TabGroupsManager.session.sessionRestoring || !TabGroupsManagerJsm.globalPreferences.lastSessionFinalized)
    {
      var newTab = event.originalTarget;
      if (TabGroupsManager.preferences.tabTreeOpenTabByExternalApplication && TabGroupsManager.tabOpenStatus.openerContext == Ci.nsIBrowserDOMWindow.OPEN_EXTERNAL)
      {
        var group = TabGroupsManager.allGroups.getGroupById(-2);
        if (!group)
        {
          group = TabGroupsManager.allGroups.openNewGroup(newTab, -2, TabGroupsManager.strings.getString("ExtAppGroupName"));
          TabGroupsManager.allGroups.changeGroupOrder(group, 0);
        }
        else
        {
          group.addTab(newTab);
        }
      }
      else if (TabGroupsManager.tabOpenStatus.openerTab)
      {
        var parentTab = TabGroupsManager.tabOpenStatus.openerTab;
        if (TabGroupsManager.preferences.tabTreeOpenTabByJavaScript)
        {
          parentTab.group.addTab(newTab);
        }
        else
        {
          TabGroupsManager.allGroups.selectedGroup.addTab(newTab);
        }
        if (!parentTab.tabGroupsManagerTabTree)
        {
          parentTab.tabGroupsManagerTabTree = new TabGroupsManager.TabTree(parentTab);
        }
        parentTab.tabGroupsManagerTabTree.addTabToTree(newTab);
      }
      else
      {
        if (this.tabOpenTarget)
        {
          this.tabOpenTarget.addTab(newTab);
        }
        else
        {
          TabGroupsManager.allGroups.selectedGroup.addTab(newTab);
        }
      }
      TabGroupsManager.groupBarDispHide.dispGroupBarByTabCount();
      newTab.tgmSelectedTime = (new Date()).getTime();
    }
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
  finally
  {
    TabGroupsManager.tabOpenStatus.clearOpenerData();
    this.tabOpenTarget = null;
  }
};

TabGroupsManager.EventListener.prototype.onTabClose = function (event)
{
  var closeTab = event.originalTarget;
  if (closeTab.tabGroupsManagerTabTree)
  {
    closeTab.tabGroupsManagerTabTree.removeTabFromTree(true);
  }
  if (closeTab.group != null)
  {
    closeTab.group.removeTab(closeTab, true);
  }
  TabGroupsManager.groupBarDispHide.hideGroupBarByTabCountDelay();
};

TabGroupsManager.EventListener.prototype.onTabSelect = function (event)
{
  var tab = gBrowser.selectedTab;
  if (tab.group == null)
  {
    //FIXME is it possible for the group to be null if we're not in the restoring code?
    if (TabGroupsManager.session.sessionRestoring)
    {
      return; //It's being weird
    }
    TabGroupsManager.allGroups.selectedGroup.addTab(tab);
  }
  if (!tab.group.selected)
  {
    tab.group.selectedTab = tab;
    TabGroupsManager.allGroups.selectedGroup = tab.group;
  }
  else
  {
    tab.group.selectedTab = tab;
  }
  tab.tgmSelectedTime = (new Date()).getTime();
};

TabGroupsManager.EventListener.prototype.onTabShow = function (event)
{
  var tab = event.target;
  if (!tab.group.selected)
  {
    TabGroupsManager.utils.hideTab(tab);
  }
};

TabGroupsManager.EventListener.prototype.onTabHide = function (event)
{
  var tab = event.target;
  let count = 0;

  function checkTabGroup()
  {
    count++;
    var activeGroupPromise = new Promise(
      function (resolve, reject)
      {
        setTimeout(function ()
        {
          if (typeof tab.group == "undefined" && count < 10)
          {
            checkTabGroup();
          }
          else resolve(tab);
        }, 50);
      });

    activeGroupPromise.then(function (tab)
    {
      if (tab.group.selected)
      {
        TabGroupsManager.utils.unHideTab(tab);
      }
    }, Components.utils.reportError);
  }

  //check if tab.group is not defined at startup since Fx25+
  if (TabGroupsManager.preferences.firefoxVersionCompare("28") == 1 && typeof tab.group == "undefined")
  {
    checkTabGroup();
  }
  else
  {
    if (tab.group.selected)
    {
      TabGroupsManager.utils.unHideTab(tab);
    }
  }
};

TabGroupsManager.EventListener.prototype.onTabMove = function (event)
{
  var tab = event.originalTarget;
  if (!TabGroupsManager.eventListener.groupSelecting)
  {
    if (tab.tabGroupsManagerTabTree)
    {
      tab.tabGroupsManagerTabTree.removeTabFromTree(false);
    }
    if (tab.group)
    {
      tab.group.sortTabArrayByTPos();
    }
  }
};

TabGroupsManager.EventListener.prototype.onGroupSelect = function (event)
{
  if (TabGroupsManager.session.allTabsMovingToGroup)
  {
    return;
  }
  TabGroupsManager.eventListener.groupSelecting = true;
  try
  {
    var selectedGroup = TabGroupsManager.allGroups.selectedGroup;
    selectedGroup.suspended = false;
    if (selectedGroup.tabArray.length == 0)
    {
      let tab = selectedGroup.makeDummyTab();
      selectedGroup.addTab(tab);
      selectedGroup.selectedTab = tab;
    }
    if (!selectedGroup.selectedTab)
    {
      selectedGroup.selectedTab = selectedGroup.tabArray[0];
    }
    for (var tab = gBrowser.mTabContainer.firstChild; tab; tab = tab.nextSibling)
    {
      if (tab.group && !tab.group.selected)
      {
        TabGroupsManager.utils.hideTab(tab);
      }
      else
      {
        TabGroupsManager.utils.unHideTab(tab);
      }
    }
    TabGroupsManager.allGroups.scrollInActiveGroup(true);
    if (!("TreeStyleTabService" in window))
    {
      if ("TabmixTabbar" in window)
      {
        if (TabGroupsManager.preferences.firefoxVersionCompare("3.7") > 0)
        {
          if (TabmixTabbar.isMultiRow)
          {
            TabmixTabbar.updateScrollStatus();
          }
          else
          {
            gBrowser.tabContainer.collapsedTabs = 0;
          }
        }
        else
        {
          gBrowser.mTabContainer.collapsedTabs = 0;
          TabmixTabbar.updateScrollStatus();
          gBrowser.mTabContainer.ensureTabIsVisible(selectedGroup.selectedTab._tPos);
          TabmixTabbar.updateBeforeAndAfter();
        }
      }
      else if ("tabBarScrollStatus" in window)
      {
        gBrowser.mTabContainer.collapsedTabs = 0;
        tabBarScrollStatus();
        gBrowser.mTabContainer.ensureTabIsVisible(selectedGroup.selectedTab._tPos);
        checkBeforeAndAfter();
      }
    }
    gBrowser.selectedTab = selectedGroup.selectedTab;
    selectedGroup.unread = false;
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
  finally
  {
    TabGroupsManager.eventListener.groupSelecting = false;
  }
};

TabGroupsManager.EventListener.prototype.onGroupClick = function (event)
{
  var group = event.target.group;
  if (group)
  {
    if (event.button == 0)
    {
      if (group.suspended)
      {
        group.suspended = false;
      }
      else
      {
        group.setSelected();
      }
    }
    else if (event.button == 1)
    {
      group.mouseCommand(TabGroupsManager.preferences.groupMClick);
    }
  }
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onGroupDblClick = function (event)
{
  if (event.button == 0)
  {
    event.target.group.mouseCommand(TabGroupsManager.preferences.groupDblClick);
  }
  else if (event.button == 2)
  {
    if (TabGroupsManager.preferences.groupDblRClick != 0)
    {
      document.getElementById("TabGroupsManagerGroupContextMenu").hidePopup();
    }
    event.target.group.mouseCommand(TabGroupsManager.preferences.groupDblRClick);
  }
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onGroupBarClick = function (event)
{
  switch (event.button)
  {
  case 0:
    TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.groupBarLClick);
    break;
  case 1:
    TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.groupBarMClick);
    break;
  }
};

TabGroupsManager.EventListener.prototype.onGroupBarDblClick = function (event)
{
  switch (event.button)
  {
  case 0:
    TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.groupBarDblClick);
    break;
  }
};

TabGroupsManager.EventListener.prototype.onButtonOpenCommand = function (event)
{
  TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonOpenLClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonOpenClick = function (event)
{
  if (event.button == 1) TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonOpenMClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonOpenDblClick = function (event)
{
  if (event.button == 0) TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonOpenDblClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonSleepCommand = function (event)
{
  TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonSleepLClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonSleepClick = function (event)
{
  if (event.button == 1) TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonSleepMClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonSleepDblClick = function (event)
{
  if (event.button == 0) TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonSleepDblClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonCloseCommand = function (event)
{
  TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonCloseLClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonCloseClick = function (event)
{
  if (event.button == 1) TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonCloseMClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonCloseDblClick = function (event)
{
  if (event.button == 0) TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonCloseDblClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonDispMClick = function (event)
{
  if (event.button == 1) TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonDispMClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onShowingSleepingGroupsMenu = function (event)
{
  TabGroupsManager.sleepingGroups.createMenu(event.currentTarget);
};

TabGroupsManager.EventListener.prototype.onHiddenSleepingGroupsMenu = function (event)
{
  TabGroupsManager.sleepingGroups.destroyMenu(event.currentTarget);
};

TabGroupsManager.EventListener.prototype.onShowingClosedGroupsMenu = function (event)
{
  TabGroupsManager.closedGroups.createMenu(event.currentTarget);
};

TabGroupsManager.EventListener.prototype.onHiddenClosedGroupsMenu = function (event)
{
  TabGroupsManager.closedGroups.destroyMenu(event.currentTarget);
};

TabGroupsManager.EventListener.prototype.contentAreaContextMenuShowHideItems = function ()
{
  document.getElementById("TabGroupsManagerLinkOpenInNewGroup").hidden = !gContextMenu.onLink;
  document.getElementById("TabGroupsManagerLinkOpenInSelectedGroup").hidden = !gContextMenu.onLink;
  document.getElementById("TabGroupsManagerLinkOpenInNewGroupSeparator").hidden = !gContextMenu.onLink;
};

TabGroupsManager.EventListener.prototype.linkOpenInNewGroup = function ()
{
  var newTab = TabGroupsManager.overrideMethod.gBrowserAddTab(TabGroupsManager.contextTargetHref);
  TabGroupsManager.allGroups.openNewGroup(newTab);
};

TabGroupsManager.EventListener.prototype.linkOpenInSelectedGroup = function ()
{
  var newTab = TabGroupsManager.overrideMethod.gBrowserAddTab(TabGroupsManager.contextTargetHref);
  var group = TabGroupsManager.allGroups.openNewGroup(newTab);
  TabGroupsManager.allGroups.selectedGroup = group;
};

