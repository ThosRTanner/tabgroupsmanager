/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.openMenu = {};

TabGroupsManager.openMenu.onShowing = function(event)
{
  this.onHidden(event);
  var flgmntNode = this.makeOpenGroupWithRegisteredNameFragment();
  TabGroupsManager.utils.insertElementAfterAnonid(event.originalTarget, "start", flgmntNode);
  var flgmntNode = this.makeOpenGroupWithHistoryFragment();
  TabGroupsManager.utils.insertElementAfterAnonid(event.originalTarget, "startHistory", flgmntNode);
};

TabGroupsManager.openMenu.onShowingRename = function(event)
{
  this.onHidden(event);
  var flgmntNode = this.makeOpenGroupWithRegisteredNameFragment(true);
  TabGroupsManager.utils.insertElementAfterAnonid(event.originalTarget, "start", flgmntNode);
  var flgmntNode = this.makeOpenGroupWithHistoryFragment(true);
  TabGroupsManager.utils.insertElementAfterAnonid(event.originalTarget, "startHistory", flgmntNode);
};

TabGroupsManager.openMenu.makeOpenGroupWithRegisteredNameFragment = function(rename)
{
  var flgmntNode = document.createDocumentFragment();
  var list = TabGroupsManagerJsm.globalPreferences.groupNameRegistered;
  var i;
  for (i = 0; i < list.length; i++)
  {
    var menuitem = document.createElement("menuitem");
    menuitem.setAttribute("label", list[i]);
    menuitem.setAttribute("class", "menuitem-iconic");
    menuitem.setAttribute("context", "TabGroupsManagerRegisteredGroupNameMenuitemContextMenu");
    menuitem.groupNameTypeIsRegistered = true;
    menuitem.groupNameIndex = i;
    if (rename)
    {
      menuitem.addEventListener("command", this.renameGroupByMenuitem, false);
    }
    else
    {
      menuitem.setAttribute("tooltiptext", TabGroupsManager.strings.getString("OpenMenuitemOpenNamedGroupHelp"));
      menuitem.addEventListener("command", this.openNamedGroupByMenuitem, false);
      menuitem.addEventListener("click", this.openNamedGroupByMenuitemClick, false);
    }
    flgmntNode.appendChild(menuitem);
  }
  if (i > 0)
  {
    var menuitem = document.createElement("menuseparator");
    menuitem.style.marginLeft = "20px";
    flgmntNode.appendChild(menuitem);
  }
  return flgmntNode;
};

TabGroupsManager.openMenu.makeOpenGroupWithHistoryFragment = function(rename)
{
  var flgmntNode = document.createDocumentFragment();
  var list = TabGroupsManagerJsm.globalPreferences.groupNameHistory;
  var i;
  for (i = 0; i < list.length; i++)
  {
    var menuitem = document.createElement("menuitem");
    menuitem.setAttribute("label", list[i]);
    menuitem.setAttribute("class", "menuitem-iconic");
    menuitem.setAttribute("context", "TabGroupsManagerHistoryGroupNameMenuitemContextMenu");
    menuitem.groupNameTypeIsRegistered = false;
    menuitem.groupNameIndex = i;
    if (rename)
    {
      menuitem.addEventListener("command", this.renameGroupByMenuitem, false);
    }
    else
    {
      menuitem.setAttribute("tooltiptext", TabGroupsManager.strings.getString("OpenMenuitemOpenNamedGroupHelp"));
      menuitem.addEventListener("command", this.openNamedGroupByMenuitem, false);
      menuitem.addEventListener("click", this.openNamedGroupByMenuitemClick, false);
    }
    flgmntNode.appendChild(menuitem);
  }
  if (i > 0)
  {
    var menuitem = document.createElement("menuseparator");
    menuitem.style.marginLeft = "20px";
    flgmntNode.appendChild(menuitem);
  }
  return flgmntNode;
};

TabGroupsManager.openMenu.onHidden = function(event)
{
  TabGroupsManager.utils.deleteFromAnonidToAnonid(event.originalTarget, "start", "end");
  TabGroupsManager.utils.deleteFromAnonidToAnonid(event.originalTarget, "startHistory", "endHistory");
};

TabGroupsManager.openMenu.openNamedGroupByMenuitem = function(event)
{
  var name = event.target.getAttribute("label");
  var group = TabGroupsManager.allGroups.openNewGroup(null, null, name, null);
  group.disableAutoRename = true;
  if (event.ctrlKey)
  {
    TabGroupsManager.allGroups.selectedGroup = group;
  }
  event.stopPropagation();
};

TabGroupsManager.openMenu.openNamedGroupByMenuitemClick = function(event)
{
  if (event.button == 1)
  {
    TabGroupsManager.openMenu.openNamedGroupByMenuitem(event);
    event.stopPropagation();
  }
};

TabGroupsManager.openMenu.renameGroupByMenuitem = function(event)
{
  var group = TabGroupsManager.groupMenu.popupGroup;
  if (group)
  {
    group.name = event.target.getAttribute("label");
    group.disableAutoRename = true;
  }
  event.stopPropagation();
};

TabGroupsManager.openMenu.menuitemDelete = function(event)
{
  var menuitem = document.popupNode;
  if (menuitem.groupNameIndex != undefined)
  {
    if (menuitem.groupNameTypeIsRegistered)
    {
      TabGroupsManagerJsm.globalPreferences.deleteGroupNameRegistered(menuitem.groupNameIndex);
    }
    else
    {
      TabGroupsManagerJsm.globalPreferences.deleteGroupNameHistory(menuitem.groupNameIndex);
    }
  }
  event.stopPropagation();
};

TabGroupsManager.openMenu.toRegisteredGroupName = function(event)
{
  var menuitem = document.popupNode;
  var name = TabGroupsManagerJsm.globalPreferences.groupNameHistory[menuitem.groupNameIndex];
  TabGroupsManagerJsm.globalPreferences.deleteGroupNameHistory(menuitem.groupNameIndex);
  TabGroupsManagerJsm.globalPreferences.addGroupNameRegistered(name);
  event.stopPropagation();
};

TabGroupsManager.openMenu.registerGroupName = function(event)
{
  var name = window.prompt(TabGroupsManager.strings.getString("RenameDialogMessage"), "");
  if (name)
  {
    TabGroupsManagerJsm.globalPreferences.addGroupNameRegistered(name);
  }
  event.stopPropagation();
};

TabGroupsManager.openMenu.clearGroupNameHistory = function(event)
{
  TabGroupsManagerJsm.globalPreferences.clearGroupNameHistory();
  event.stopPropagation();
};
