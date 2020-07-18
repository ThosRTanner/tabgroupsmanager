/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm, gBrowser, Ci */

TabGroupsManager.EventListener = function()
{
  this.groupSelecting = false;
  this.tabOpenTarget = null;
};

TabGroupsManager.EventListener.prototype.createEventListener = function()
{
  var groupTabs = document.getElementById("TabGroupsManagerGroupbar");
  groupTabs.addEventListener("mousedown", this, true);
  groupTabs.addEventListener("click", this);
  groupTabs.addEventListener("dblclick", this);
  groupTabs.addEventListener("select", this);
  if (!("TMP_TabGroupsManager" in window))
  {
    gBrowser.tabContainer.addEventListener("TabOpen", this);
    gBrowser.tabContainer.addEventListener("TabClose", this);
  }
  gBrowser.tabContainer.addEventListener("TabSelect", this);
  gBrowser.tabContainer.addEventListener("TabMove", this);
  gBrowser.tabContainer.addEventListener("TabShow", this);
  gBrowser.tabContainer.addEventListener("TabHide", this);
  var contextMenu = document.getElementById("contentAreaContextMenu");
  if (contextMenu)
  {
    contextMenu.addEventListener("popupshowing", this);
  }
};

TabGroupsManager.EventListener.prototype.destroyEventListener = function()
{
  var groupTabs = document.getElementById("TabGroupsManagerGroupbar");
  groupTabs.removeEventListener("mousedown", this, true);
  groupTabs.removeEventListener("click", this);
  groupTabs.removeEventListener("dblclick", this);
  groupTabs.removeEventListener("select", this);
  if (!("TMP_TabGroupsManager" in window))
  {
    gBrowser.tabContainer.removeEventListener("TabOpen", this);
    gBrowser.tabContainer.removeEventListener("TabClose", this);
  }
  gBrowser.tabContainer.removeEventListener("TabSelect", this);
  gBrowser.tabContainer.removeEventListener("TabMove", this);
  var contextMenu = document.getElementById("contentAreaContextMenu");
  if (contextMenu)
  {
    contextMenu.removeEventListener("popupshowing", this);
  }
};

TabGroupsManager.EventListener.prototype.handleEvent = function(event)
{
  //FIXME I am somewhat suspicious of the tab event intercepts. Especially asin
  //the onhide one calls unhide on the selected one.
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

    default:
      break;
  }
};

TabGroupsManager.EventListener.prototype.onTabOpen = function(event)
{
  try
  {
    if (! TabGroupsManager.session.sessionRestoring)
    {
      const newTab = event.originalTarget;
      if (TabGroupsManager.preferences.tabTreeOpenTabByExternalApplication &&
          TabGroupsManager.tabOpenStatus.openerContext == Ci.nsIBrowserDOMWindow.OPEN_EXTERNAL)
      {
        let group = TabGroupsManager.allGroups.getGroupById(-2);
        if (group)
        {
          group.addTab(newTab);
        }
        else
        {
          group = TabGroupsManager.allGroups.openNewGroup(newTab, -2, TabGroupsManager.strings.getString("ExtAppGroupName"));
          TabGroupsManager.allGroups.changeGroupOrder(group, 0);
        }
      }
      else if (TabGroupsManager.tabOpenStatus.openerTab)
      {
        const parentTab = TabGroupsManager.tabOpenStatus.openerTab;
        if (TabGroupsManager.preferences.tabTreeOpenTabByJavaScript)
        {
          parentTab.group.addTab(newTab);
        }
        else
        {
          TabGroupsManager.allGroups.selectedGroup.addTab(newTab);
        }
        if (! parentTab.tabGroupsManagerTabTree)
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
  catch (err)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(err);
  }
  finally
  {
    TabGroupsManager.tabOpenStatus.clearOpenerData();
    this.tabOpenTarget = null;
  }
};

TabGroupsManager.EventListener.prototype.onTabClose = function(event)
{
  const closeTab = event.originalTarget;
  if (closeTab.tabGroupsManagerTabTree)
  {
    closeTab.tabGroupsManagerTabTree.removeTabFromTree(true);
  }
  //FIXME How can this ever be null?
  if (closeTab.group != null)
  {
    closeTab.group.removeTab(closeTab, true);
  }
  TabGroupsManager.groupBarDispHide.hideGroupBarByTabCountDelay();
};

TabGroupsManager.EventListener.prototype.onTabSelect = function(event)
{
  const tab = gBrowser.selectedTab;
  if (tab.group == null)
  {
    //FIXME is it possible for the group to be null if we're not in the
    //restoring code? Also, houldn't we just do this check first?
    if (TabGroupsManager.session.sessionRestoring)
    {
      return; //It's being weird
    }
    TabGroupsManager.allGroups.selectedGroup.addTab(tab);
  }
  if (! tab.group.selected)
  {
    TabGroupsManager.allGroups.selectedGroup = tab.group;
  }
  tab.group.selectedTab = tab;
  tab.tgmSelectedTime = (new Date()).getTime();
};

//FIXME Why would someone else be hiding/showing tabs?
TabGroupsManager.EventListener.prototype.onTabShow = function(event)
{
  const tab = event.target;
  if (! tab.group.selected)
  {
    TabGroupsManager.utils.hideTab(tab);
  }
};

TabGroupsManager.EventListener.prototype.onTabHide = function(event)
{
  //FIXME The ONLY time I have ever seen this event happen is when restoring
  //tabs from Basilisk and doing a timed callback ends up doing nothing useful.
  if (TabGroupsManager.session.sessionRestoring)
  {
    return;
  }

  const tab = event.target;
  if (tab.group.selected)
  {
    TabGroupsManager.utils.unHideTab(tab);
  }
};

TabGroupsManager.EventListener.prototype.onTabMove = function(event)
{
  if (TabGroupsManager.eventListener.groupSelecting)
  {
    return;
  }
  const tab = event.originalTarget;
  if (tab.tabGroupsManagerTabTree)
  {
    tab.tabGroupsManagerTabTree.removeTabFromTree(false);
  }
  if (tab.group)
  {
    tab.group.sortTabArrayByTPos();
  }
};

TabGroupsManager.EventListener.prototype.onGroupSelect = function(event)
{
  TabGroupsManager.eventListener.groupSelecting = true;
  try
  {
    const selectedGroup = TabGroupsManager.allGroups.selectedGroup;
    selectedGroup.suspended = false;
    if (selectedGroup.tabArray.length == 0)
    {
      const tab = selectedGroup.makeDummyTab();
      selectedGroup.addTab(tab);
      selectedGroup.selectedTab = tab;
    }
    if (! selectedGroup.selectedTab)
    {
      selectedGroup.selectedTab = selectedGroup.tabArray[0];
    }
    for (const tab of gBrowser.mTabContainer.childNodes)
    {
      //FIXME Why would tab.group not be set?
      if (tab.group && ! tab.group.selected)
      {
        TabGroupsManager.utils.hideTab(tab);
      }
      else
      {
        TabGroupsManager.utils.unHideTab(tab);
      }
    }
    TabGroupsManager.allGroups.scrollInActiveGroup(true);
    if (! ("TreeStyleTabService" in window))
    {
      if ("TabmixTabbar" in window)
      {
        if (window.TabmixTabbar.isMultiRow)
        {
          window.TabmixTabbar.updateScrollStatus();
        }
        else
        {
          gBrowser.tabContainer.collapsedTabs = 0;
        }
      }
      else if ("tabBarScrollStatus" in window)
      {
        //FIXME Check - this appears to be to do with treestyletab and may no
        //longer be necessary
        gBrowser.mTabContainer.collapsedTabs = 0;
        window.tabBarScrollStatus();
        gBrowser.mTabContainer.ensureTabIsVisible(selectedGroup.selectedTab._tPos);
        window.checkBeforeAndAfter();
      }
    }
    gBrowser.selectedTab = selectedGroup.selectedTab;
    selectedGroup.unread = false;
  }
  catch (err)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(err);
  }
  finally
  {
    TabGroupsManager.eventListener.groupSelecting = false;
  }
};

TabGroupsManager.EventListener.prototype.onGroupClick = function(event)
{
  const group = event.target.group;
  //FIXME how can this be null???
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

TabGroupsManager.EventListener.prototype.onGroupDblClick = function(event)
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

TabGroupsManager.EventListener.prototype.onGroupBarClick = function(event)
{
  switch (event.button)
  {
    case 0:
      TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.groupBarLClick);
      break;

    case 1:
      TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.groupBarMClick);
      break;

    default:
      break;
  }
};

TabGroupsManager.EventListener.prototype.onGroupBarDblClick = function(event)
{
  if (event.button == 0)
  {
    TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.groupBarDblClick);
  }
};

TabGroupsManager.EventListener.prototype.onButtonOpenCommand = function(event)
{
  TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonOpenLClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonOpenClick = function(event)
{
  if (event.button == 1)
  {
    TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonOpenMClick);
  }
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonOpenDblClick = function(event)
{
  if (event.button == 0)
  {
    TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonOpenDblClick);
  }
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonSleepCommand = function(event)
{
  TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonSleepLClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonSleepClick = function(event)
{
  if (event.button == 1)
  {
    TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonSleepMClick);
  }
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonSleepDblClick = function(event)
{
  if (event.button == 0)
  {
    TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonSleepDblClick);
  }
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonCloseCommand = function(event)
{
  TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonCloseLClick);
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonCloseClick = function(event)
{
  if (event.button == 1)
  {
    TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonCloseMClick);
  }
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonCloseDblClick = function(event)
{
  if (event.button == 0)
  {
    TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonCloseDblClick);
  }
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onButtonDispMClick = function(event)
{
  if (event.button == 1)
  {
    TabGroupsManager.allGroups.mouseCommand(TabGroupsManager.preferences.buttonDispMClick);
  }
  event.stopPropagation();
};

TabGroupsManager.EventListener.prototype.onShowingSleepingGroupsMenu = function(event)
{
  TabGroupsManager.sleepingGroups.createMenu(event.currentTarget);
};

TabGroupsManager.EventListener.prototype.onHiddenSleepingGroupsMenu = function(event)
{
  TabGroupsManager.sleepingGroups.destroyMenu(event.currentTarget);
};

TabGroupsManager.EventListener.prototype.onShowingClosedGroupsMenu = function(event)
{
  TabGroupsManager.closedGroups.createMenu(event.currentTarget);
};

TabGroupsManager.EventListener.prototype.onHiddenClosedGroupsMenu = function(event)
{
  TabGroupsManager.closedGroups.destroyMenu(event.currentTarget);
};

TabGroupsManager.EventListener.prototype.contentAreaContextMenuShowHideItems = function()
{
  document.getElementById("TabGroupsManagerLinkOpenInNewGroup").hidden =
    ! gContextMenu.onLink;
  document.getElementById("TabGroupsManagerLinkOpenInSelectedGroup").hidden =
    ! gContextMenu.onLink;
  document.getElementById("TabGroupsManagerLinkOpenInNewGroupSeparator").hidden =
    ! gContextMenu.onLink;
};

TabGroupsManager.EventListener.prototype.linkOpenInNewGroup = function()
{
  const newTab = TabGroupsManager.overrideMethod.gBrowserAddTab(TabGroupsManager.contextTargetHref);
  TabGroupsManager.allGroups.openNewGroup(newTab);
};

TabGroupsManager.EventListener.prototype.linkOpenInSelectedGroup = function()
{
  const newTab = TabGroupsManager.overrideMethod.gBrowserAddTab(TabGroupsManager.contextTargetHref);
  const group = TabGroupsManager.allGroups.openNewGroup(newTab);
  TabGroupsManager.allGroups.selectedGroup = group;
};
