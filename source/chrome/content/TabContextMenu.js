/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.TabContextMenu = function() {};

TabGroupsManager.TabContextMenu.prototype.makeMenu = function()
{
  var flgmntNode = document.createDocumentFragment();
  flgmntNode.appendChild(document.createElement("menuseparator"));
  var sendToMenu = document.createElement("menu");
  sendToMenu.setAttribute("id", "TabGroupsManagerTabContextMenuSendToOtherGroup");
  sendToMenu.setAttribute("label", TabGroupsManager.strings.getString("SendToOtherGroup"));
  var sendToMenuPopup = document.createElement("menupopup");
  sendToMenuPopup.addEventListener("popupshowing", this.sendToMenuPopup, false);
  sendToMenuPopup.addEventListener("popuphidden", this.sendToMenuHidden, false);
  sendToMenu.appendChild(sendToMenuPopup);
  flgmntNode.appendChild(sendToMenu);
  flgmntNode.appendChild(this.makeOneMenuitem("TabContextMenuCloseOtherTab", "CloseOtherTab", this.closeOtherTabInGroup));
  flgmntNode.appendChild(this.makeOneMenuitem("TabContextMenuCloseLeftTab", "CloseLeftTab", this.closeLeftTabInGroup));
  flgmntNode.appendChild(this.makeOneMenuitem("TabContextMenuSelectLeftTab", "SelectLeftTab", this.selectLeftTabInGroupWithHTM));
  flgmntNode.appendChild(this.makeOneMenuitem("TabContextMenuCloseRightTab", "CloseRightTab", this.closeRightTabInGroup));
  flgmntNode.appendChild(this.makeOneMenuitem("TabContextMenuSelectRightTab", "SelectRightTab", this.selectRightTabInGroupWithHTM));
  let menu = gBrowser.tabContextMenu;
  if (!menu)
  {
    menu = document.getAnonymousElementByAttribute(gBrowser, "anonid", "tabContextMenu");
  }
  menu.appendChild(flgmntNode);
  menu.addEventListener("popupshowing", this.contextMenuPopup, false);
};

TabGroupsManager.TabContextMenu.prototype.deleteMenu = function()
{
  let menu = gBrowser.tabContextMenu;
  if (!menu)
  {
    menu = document.getAnonymousElementByAttribute(gBrowser, "anonid", "tabContextMenu");
  }
  //fix deleting null items on exit (exception seen while debugging and reloading with F5).
  var menuObject = document.getElementById("TabGroupsManagerTabContextMenuCloseOtherTabMenuid");
  if (('undefined' !== typeof menuObject) && (menuObject))
  {
    menu.removeChild(menuObject);
  }
  menuObject = document.getElementById("TabGroupsManagerTabContextMenuCloseLeftTabMenuid");
  if (('undefined' !== typeof menuObject) && (menuObject))
  {
    menu.removeChild(menuObject);
  }
  menuObject = document.getElementById("TabGroupsManagerTabContextMenuSelectLeftTabMenuid");
  if (('undefined' !== typeof menuObject) && (menuObject))
  {
    menu.removeChild(menuObject);
  }
  menuObject = document.getElementById("TabGroupsManagerTabContextMenuCloseRightTabMenuid");
  if (('undefined' !== typeof menuObject) && (menuObject))
  {
    menu.removeChild(menuObject);
  }
  menuObject = document.getElementById("TabGroupsManagerTabContextMenuSelectRightTabMenuid");
  if (('undefined' !== typeof menuObject) && (menuObject))
  {
    menu.removeChild(menuObject);
  }

  menu.removeEventListener("popupshowing", this.contextMenuPopup, false);
};

TabGroupsManager.TabContextMenu.prototype.makeOneMenuitem = function(id, name, command)
{
  var menuitem = document.createElement("menuitem");
  menuitem.setAttribute("id", "TabGroupsManager" + id + "Menuid");
  menuitem.setAttribute("label", TabGroupsManager.strings.getString(name + "MenuItemLabel"));
  menuitem.setAttribute("accesskey", TabGroupsManager.strings.getString(name + "MenuItemAccesskey"));
  menuitem.addEventListener("command", command, false);
  return menuitem;
};

TabGroupsManager.TabContextMenu.prototype.contextMenuPopup = function()
{
  var tabContextMenuSendToOtherGroup = document.getElementById("TabGroupsManagerTabContextMenuSendToOtherGroup");
  var tabContextMenuCloseOtherTab = document.getElementById("TabGroupsManagerTabContextMenuCloseOtherTabMenuid");
  var tabContextMenuCloseLeftTab = document.getElementById("TabGroupsManagerTabContextMenuCloseLeftTabMenuid");
  var tabContextMenuCloseRightTab = document.getElementById("TabGroupsManagerTabContextMenuCloseRightTabMenuid");
  var tabContextMenuSelectLeftTab = document.getElementById("TabGroupsManagerTabContextMenuSelectLeftTabMenuid");
  var tabContextMenuSelectRightTab = document.getElementById("TabGroupsManagerTabContextMenuSelectRightTabMenuid");
  if (!document.popupNode.group)
  {
    tabContextMenuSendToOtherGroup.hidden = true;
    tabContextMenuCloseOtherTab.hidden = true;
    tabContextMenuCloseLeftTab.hidden = true;
    tabContextMenuCloseRightTab.hidden = true;
    tabContextMenuSelectLeftTab.hidden = true;
    tabContextMenuSelectRightTab.hidden = true;
    return;
  }
  tabContextMenuSendToOtherGroup.hidden = !TabGroupsManager.preferences.tabMenuSendToOtherGroup;
  tabContextMenuCloseOtherTab.hidden = !TabGroupsManager.preferences.tabMenuCloseOtherTabInGroup;
  tabContextMenuCloseLeftTab.hidden = !TabGroupsManager.preferences.tabMenuCloseLeftTabInGroup;
  tabContextMenuCloseRightTab.hidden = !TabGroupsManager.preferences.tabMenuCloseRightTabInGroup;
  tabContextMenuSelectLeftTab.hidden = !("MultipleTabService" in window) || !TabGroupsManager.preferences.tabMenuSelectLeftTabInGroup;
  tabContextMenuSelectRightTab.hidden = !("MultipleTabService" in window) || !TabGroupsManager.preferences.tabMenuSelectRightTabInGroup;
  var targetTab = document.popupNode;
  var disabledLeft = !TabGroupsManager.tabContextMenu.existsLeftTabInGroup(targetTab);
  var disabledRight = !TabGroupsManager.tabContextMenu.existsRightTabInGroup(targetTab);
  var disabledOhter = disabledLeft && disabledRight;
  tabContextMenuCloseOtherTab.setAttribute("disabled", disabledOhter);
  tabContextMenuCloseLeftTab.setAttribute("disabled", disabledLeft);
  tabContextMenuCloseRightTab.setAttribute("disabled", disabledRight);
};

TabGroupsManager.TabContextMenu.prototype.sendToMenuPopup = function(event)
{
  TabGroupsManager.tabContextMenu.sendToMenuHidden(event);
  var flgmntNode = document.createDocumentFragment();
  var menuitem = document.createElement("menuitem");
  menuitem.setAttribute("label", TabGroupsManager.strings.getString("SendToNewGroup"));
  menuitem.setAttribute("class", "menuitem-iconic");
  menuitem.addEventListener("command", TabGroupsManager.tabContextMenu.sendTabToNewGroup, false);
  flgmntNode.appendChild(menuitem);
  flgmntNode.appendChild(document.createElement("menuseparator"));
  for (var i = 0; i < TabGroupsManager.allGroups.childNodes.length; i++)
  {
    var nowGroup = TabGroupsManager.allGroups.childNodes[i].group;
    var menuitem = document.createElement("menuitem");
    menuitem.setAttribute("value", nowGroup.id);
    menuitem.setAttribute("label", nowGroup.name || TabGroupsManager.strings.getString("NewGroupName"));
    menuitem.setAttribute("image", nowGroup.image);
    menuitem.setAttribute("class", "menuitem-iconic");
    menuitem.setAttribute("validate", "never");
    if (nowGroup.id == document.popupNode.group.id)
    {
      menuitem.setAttribute("disabled", "true");
    }
    menuitem.addEventListener("command", TabGroupsManager.tabContextMenu.sendTabToGroup, false);
    flgmntNode.appendChild(menuitem);
  }
  flgmntNode.appendChild(document.createElement("menuseparator"));
  for (var i = 0; i < TabGroupsManager.sleepingGroups.store.length; i++)
  {
    var nowGroup = TabGroupsManager.sleepingGroups.store[i];
    var menuitem = document.createElement("menuitem");
    menuitem.setAttribute("value", nowGroup.id);
    menuitem.setAttribute("label", nowGroup.name || TabGroupsManager.strings.getString("NewGroupName"));
    menuitem.setAttribute("image", nowGroup.image);
    menuitem.setAttribute("class", "menuitem-iconic");
    menuitem.setAttribute("validate", "never");
    menuitem.addEventListener("command", TabGroupsManager.tabContextMenu.sendTabToSleepingGroup, false);
    flgmntNode.appendChild(menuitem);
  }
  var sendToMenuPopup = event.target;
  sendToMenuPopup.appendChild(flgmntNode);
};

TabGroupsManager.TabContextMenu.prototype.sendToMenuHidden = function(event)
{
  var sendToMenuPopup = event.target;
  TabGroupsManager.utils.deleteFromAnonidToAnonid(sendToMenuPopup);
};

TabGroupsManager.TabContextMenu.prototype.sendTabToNewGroup = function(event)
{
  var tab = document.popupNode;
  TabGroupsManager.allGroups.moveTabToGroupInSameWindow(tab, null, event.ctrlKey);
};

TabGroupsManager.TabContextMenu.prototype.sendTabToGroup = function(event)
{
  var tab = document.popupNode;
  var groupId = event.target.getAttribute("value") - 0;
  var group = TabGroupsManager.allGroups.getGroupById(groupId);
  TabGroupsManager.allGroups.moveTabToGroupInSameWindow(tab, group, event.ctrlKey);
};

TabGroupsManager.TabContextMenu.prototype.sendTabToSleepingGroup = function(event)
{
  var tab = document.popupNode;
  var groupId = event.target.getAttribute("value") - 0;
  TabGroupsManager.sleepingGroups.sendTabToGroupsStore(tab, groupId);
};

TabGroupsManager.TabContextMenu.prototype.closeLeftTabInGroup = function()
{
  var targetTab = document.popupNode;
  var targetGroup = targetTab.group;
  for (var tab = targetTab.previousSibling; tab;)
  {
    var nextTab = tab.previousSibling;
    if (tab.group == targetGroup)
    {
      if (gBrowser.selectedTab == tab)
      {
        gBrowser.selectedTab = document.popupNode;
      }
      gBrowser.removeTab(tab);
    }
    tab = nextTab;
  }
};

TabGroupsManager.TabContextMenu.prototype.closeRightTabInGroup = function()
{
  var targetTab = document.popupNode;
  var targetGroup = targetTab.group;
  for (var tab = targetTab.nextSibling; tab;)
  {
    var nextTab = tab.nextSibling;
    if (tab.group == targetGroup)
    {
      if (gBrowser.selectedTab == tab)
      {
        gBrowser.selectedTab = document.popupNode;
      }
      gBrowser.removeTab(tab);
    }
    tab = nextTab;
  }
};

TabGroupsManager.TabContextMenu.prototype.selectLeftTabInGroupWithHTM = function()
{
  var targetTab = document.popupNode;
  var targetGroup = targetTab.group;
  for (var tab = targetTab; tab;)
  {
    var nextTab = tab.previousSibling;
    if (tab.group == targetGroup)
    {
      if (gBrowser.selectedTab == tab)
      {
        gBrowser.selectedTab = document.popupNode;
      }
      MultipleTabService.toggleSelection(tab);
    }
    tab = nextTab;
  }
};

TabGroupsManager.TabContextMenu.prototype.selectRightTabInGroupWithHTM = function()
{
  var targetTab = document.popupNode;
  var targetGroup = targetTab.group;
  for (var tab = targetTab; tab;)
  {
    var nextTab = tab.nextSibling;
    if (tab.group == targetGroup)
    {
      if (gBrowser.selectedTab == tab)
      {
        gBrowser.selectedTab = document.popupNode;
      }
      MultipleTabService.toggleSelection(tab);
    }
    tab = nextTab;
  }
};

TabGroupsManager.TabContextMenu.prototype.closeOtherTabInGroup = function()
{
  TabGroupsManager.tabContextMenu.closeRightTabInGroup();
  TabGroupsManager.tabContextMenu.closeLeftTabInGroup();
};

TabGroupsManager.TabContextMenu.prototype.existsLeftTabInGroup = function(targetTab)
{
  var targetGroup = targetTab.group;
  for (var tab = targetTab.previousSibling; tab; tab = tab.previousSibling)
  {
    if (tab.group == targetGroup)
    {
      return true;
    }
  }
  return false;
};

TabGroupsManager.TabContextMenu.prototype.existsRightTabInGroup = function(targetTab)
{
  var targetGroup = targetTab.group;
  for (var tab = targetTab.nextSibling; tab; tab = tab.nextSibling)
  {
    if (tab.group == targetGroup)
    {
      return true;
    }
  }
  return false;
};

