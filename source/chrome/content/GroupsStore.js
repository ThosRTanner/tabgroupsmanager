/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.GroupsStore = function (storeFunction, maxLength, saveWhenChangeing, menuitemContextMenu)
{
  try
  {
    this.maxLength = maxLength;
    this.saveWhenChangeing = (saveWhenChangeing === true);
    this.menuitemContextMenu = menuitemContextMenu;
    this.__defineGetter__("store", storeFunction);
    var _this = this;
    this.menuitemCommandEvent = function (event)
    {
      _this.onMenuitemCommand(event);
    };

    this.menuitemClickEvent = function (event)
    {
      _this.onMenuitemClick(event);
    };

    this.contextCommandEvent = function (event)
    {
      _this.onContextMenuCommand(event);
    };

    this.contextClickEvent = function (event)
    {
      _this.onContextMenuClick(event);
    };

  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};


TabGroupsManager.GroupsStore.prototype.addGroup = function (groupData, closeGroup)
{
  var groupDataTmp = this.pop(groupData.id);
  if (groupDataTmp)
  {
    for (var i = 0; i < groupData.tabs.length; i++)
    {
      groupDataTmp.tabs.push(groupData.tabs[i]);
    }
    groupDataTmp.titleList += groupData.titleList;
    groupData = groupDataTmp;
  }
  this.store.unshift(groupData);
  this.storeLimitCheck();
  if (closeGroup)
  {
    closeGroup.close();
  }
  if (this.saveWhenChangeing)
  {
    TabGroupsManagerJsm.saveData.saveLatestData();
  }
};


TabGroupsManager.GroupsStore.prototype.sendTabToGroupsStore = function (tab, groupId)
{
  var groupData = this.peek(groupId);
  if (groupData)
  {
    TabGroupsManager.session.sessionStore.setTabValue(tab, "TabGroupsManagerGroupId", groupId.toString());
    TabGroupsManager.session.sessionStore.setTabValue(tab, "TabGroupsManagerGroupName", groupData.name);
    groupData.titleList += tab.linkedBrowser.contentTitle + "\n";
    groupData.tabs.push(TabGroupsManager.session.getTabStateEx(tab));
    tab.group.removeTabWithoutClosedTabsList(tab);
  }
};

TabGroupsManager.GroupsStore.prototype.restoreGroup = function (groupId)
{
  var groupData = this.pop(groupId);
  if (groupData)
  {
    var group = TabGroupsManager.allGroups.getGroupById(groupData.id);
    if (!group)
    {
      group = TabGroupsManager.allGroups.openNewGroupCore(groupData.id, groupData.name, groupData.image);
    }
    else
    {
      TabGroupsManager.allGroups.beginUpdate();
      this.name = groupData.name;
      this.image = groupData.image;
      TabGroupsManager.allGroups.endUpdate();
    }
    group.setGroupDataWithAllTabs(groupData);
    if (this.saveWhenChangeing)
    {
      TabGroupsManagerJsm.saveData.saveLatestData();
    }
  }
};

TabGroupsManager.GroupsStore.prototype.restoreGroupPart = function (groupId, tabObject)
{
  var groupData = this.peek(groupId);
  if (groupData)
  {
    if (groupData.tabs.length < 2)
    {
      this.restoreGroup(groupId);
      return true;
    }
    else
    {
      var group = TabGroupsManager.allGroups.getGroupById(groupData.id);
      if (!group)
      {
        group = TabGroupsManager.allGroups.openNewGroupCore(groupData.id, groupData.name, groupData.image);
      }
      else
      {
        TabGroupsManager.allGroups.beginUpdate();
        this.name = groupData.name;
        this.image = groupData.image;
        TabGroupsManager.allGroups.endUpdate();
      }
      group.setGroupDataWithAllTabs(groupData, tabObject);
      var splitTitleList = groupData.titleList.split(/\n/);
      for (var i = 0; i < groupData.tabs.length; i++)
      {
        if (groupData.tabs[i] == tabObject)
        {
          groupData.tabs.splice(i, 1);
          splitTitleList.splice(i, 1);
          break;
        }
      }
      groupData.titleList = splitTitleList.join("\n");
      if (this.saveWhenChangeing)
      {
        TabGroupsManagerJsm.saveData.saveLatestData();
      }
    }
  }
  return false;
};

TabGroupsManager.GroupsStore.prototype.restoreLatestGroup = function ()
{
  if (this.store.length > 0)
  {
    this.restoreGroup(this.store[0].id);
  }
};

TabGroupsManager.GroupsStore.prototype.setMaxLength = function (value)
{
  this.maxLength = value;
  this.storeLimitCheck();
  TabGroupsManagerJsm.saveData.saveLatestData();
};

TabGroupsManager.GroupsStore.prototype.clear = function ()
{
  this.store.splice(0, this.store.length);
  TabGroupsManagerJsm.saveData.saveLatestData();
};

TabGroupsManager.GroupsStore.prototype.createMenu = function (menuPopup)
{
  this.destroyMenu(menuPopup);
  let insertPosition = menuPopup.firstChild;
  for (let i = 0; i < this.store.length; i++)
  {
    var nowGroup = this.store[i];
    var menuitem = document.createElement("menuitem");
    menuitem.setAttribute("value", nowGroup.id);
    menuitem.setAttribute("label", (nowGroup.name || TabGroupsManager.strings.getString("NewGroupName")) + "(" + nowGroup.tabs.length + ")");
    menuitem.setAttribute("image", nowGroup.image);
    menuitem.className = "menuitem-iconic menuitem-with-favicon";
    menuitem.setAttribute("validate", "never");
    menuitem.setAttribute("tooltiptext", nowGroup.titleList);
    menuitem.setAttribute("context", this.menuitemContextMenu);
    menuitem.addEventListener("command", this.menuitemCommandEvent, false);
    menuitem.addEventListener("click", this.menuitemClickEvent, false);
    let start = new Date();
    menuPopup.insertBefore(menuitem, insertPosition);
    if ((new Date()).getTime() - start.getTime() > 3000)
    {
      nowGroup.image = "moz-anno:favicon:" + nowGroup.image;
      menuitem.setAttribute("image", nowGroup.image);
    }
  }
  if (this.store.length == 0)
  {
    var menuitem = document.createElement("menuitem");
    menuitem.setAttribute("label", TabGroupsManager.strings.getString("MenuitemThereIsNoData"));
    menuitem.setAttribute("disabled", true);
    menuPopup.insertBefore(menuitem, insertPosition);
  }
};

TabGroupsManager.GroupsStore.prototype.destroyMenu = function (menuPopup)
{
  while (true)
  {
    var menuitem = menuPopup.firstChild;
    if (!menuitem || menuitem.tagName == "menuseparator")
    {
      break;
    }
    menuitem.removeEventListener("command", this.menuitemCommandEvent, false);
    menuitem.removeEventListener("click", this.menuitemClickEvent, false);
    menuPopup.removeChild(menuitem);
  }
};

TabGroupsManager.GroupsStore.prototype.onMenuitemCommand = function (event)
{
  this.restoreGroup(event.originalTarget.getAttribute("value") - 0);
};

TabGroupsManager.GroupsStore.prototype.onMenuitemClick = function (event)
{
  if (event.button == 1)
  {
    this.restoreGroup(event.target.getAttribute("value") - 0);
    event.target.parentNode.removeChild(event.target);
  }
};

TabGroupsManager.GroupsStore.prototype.onShowingMenuitemContextMenu = function (event)
{
  var group = this.peek(document.popupNode.getAttribute("value") - 0);
  if (!group || !group.tabs)
    return;
  this.onHiddenMenuitemContextMenu(event);
  var flgmntNode = document.createDocumentFragment();
  for (var i = 0; i < group.tabs.length; i++)
  {
    var tabData = JSON.parse(group.tabs[i]);
    var title = null;
    try
    {
      title = (tabData.entries[tabData.index - 1].title) ? tabData.entries[tabData.index - 1].title : "untitled";
    }
    catch (e)
    {
      title = "untitled";
    }
    var image = (tabData.attributes) ? tabData.attributes.image : null;
    var menuitem = document.createElement("menuitem");
    menuitem.setAttribute("maxwidth", "300");
    menuitem.setAttribute("label", title);
    menuitem.setAttribute("image", image);
    menuitem.setAttribute("class", "menuitem-iconic");
    menuitem.setAttribute("validate", "never");
    menuitem.addEventListener("command", this.contextCommandEvent, false);
    menuitem.addEventListener("click", this.contextClickEvent, false);
    menuitem.tabObject = group.tabs[i];
    flgmntNode.appendChild(menuitem);
  }
  TabGroupsManager.utils.insertElementAfterAnonid(event.target, null, flgmntNode);
};

TabGroupsManager.GroupsStore.prototype.onHiddenMenuitemContextMenu = function (event)
{
  TabGroupsManager.utils.deleteFromAnonidToAnonid(event.target, null, "end");
};

TabGroupsManager.GroupsStore.prototype.onContextMenuCommand = function (event)
{
  var groupId = document.popupNode.getAttribute("value") - 0;
  var tabObject = event.target.tabObject;
  this.restoreGroupPart(groupId, tabObject);
};

TabGroupsManager.GroupsStore.prototype.onContextMenuClick = function (event)
{
  if (event.button == 1)
  {
    var groupId = document.popupNode.getAttribute("value") - 0;
    var tabObject = event.target.tabObject;
    if (this.restoreGroupPart(groupId, tabObject))
    {
      event.target.parentNode.hidePopup();
      document.popupNode.parentNode.removeChild(document.popupNode);
    }
    else
    {
      event.target.parentNode.removeChild(event.target);
    }
  }
};

TabGroupsManager.GroupsStore.prototype.pop = function (groupId)
{
  for (var i = 0; i < this.store.length; i++)
  {
    if (this.store[i].id == groupId)
    {
      var groupData = this.store[i];
      this.store.splice(i, 1);
      return groupData;
    }
  }
  return null;
};

TabGroupsManager.GroupsStore.prototype.peek = function (groupId)
{
  for (var i = 0; i < this.store.length; i++)
  {
    if (this.store[i].id == groupId)
    {
      return this.store[i];
    }
  }
  return null;
};

TabGroupsManager.GroupsStore.prototype.storeLimitCheck = function ()
{
  if (this.maxLength >= 0)
  {
    this.store.splice(this.maxLength);
  }
};

TabGroupsManager.GroupsStore.prototype.getGroupById = function (id)
{
  for (var i = 0; i < this.store.length; i++)
  {
    if (this.store[i].id == id)
    {
      return this.store[i];
    }
  }
  return null;
};

TabGroupsManager.GroupsStore.prototype.bookmarkAllStoredGroup = function (parentFolder)
{
  for (var i = 0; i < this.store.length; i++)
  {
    var group = this.store[i];
    this.bookmarkOneGroup(group, group.name, parentFolder);
  }
};

TabGroupsManager.GroupsStore.prototype.setSleepGroupsImage = function ()
{
  var sleepButton = document.getElementById("TabGroupsManagerButtonSleep");
  if (sleepButton)
  {
    sleepButton.setAttribute("storecount", this.store.length);
  }
};

TabGroupsManager.GroupsStore.prototype.sendToClosedGroup = function (event)
{
  var id = document.popupNode.getAttribute("value") - 0;
  var group = TabGroupsManager.sleepingGroups.pop(id);
  TabGroupsManager.closedGroups.addGroup(group);
  TabGroupsManager.sleepingGroups.setSleepGroupsImage();
  TabGroupsManagerJsm.saveData.saveLatestData();
};

TabGroupsManager.GroupsStore.prototype.sendToClosedGroupClick = function (event)
{
  if (event.button == 1)
  {
    TabGroupsManager.sleepingGroups.sendToClosedGroup(event);
    document.getElementById("TabGroupsManagerSleepingGroupsMenuitemContextMenu").hidePopup();
    let menu2 = document.getElementById("TabGroupsManagerSleepingGroupsButtonMenu");
    menu2.hidePopup();
    menu2.openPopup(document.getElementById("TabGroupsManagerButtonSleep"), "after_start", 0, 0, false, false);
  }
};

TabGroupsManager.GroupsStore.prototype.sendThisGroupToHibernatedGroup = function ()
{
  var id = document.popupNode.getAttribute("value") - 0;
  var group = TabGroupsManager.closedGroups.pop(id);
  TabGroupsManager.sleepingGroups.addGroup(group);
  TabGroupsManager.sleepingGroups.setSleepGroupsImage();
  TabGroupsManagerJsm.saveData.saveLatestData();
};

TabGroupsManager.GroupsStore.prototype.deleteThisGroup = function ()
{
  var id = document.popupNode.getAttribute("value") - 0;
  var group = TabGroupsManager.closedGroups.pop(id);
  TabGroupsManagerJsm.saveData.saveLatestData();
};

TabGroupsManager.GroupsStore.prototype.bookmarkSleepingGroup = function ()
{
  var id = document.popupNode.getAttribute("value") - 0;
  var group = TabGroupsManager.sleepingGroups.peek(id);
  var folderName = window.prompt(TabGroupsManager.strings.getString("EnterBookmarkFolderName"), group.name);
  if (folderName)
  {
    this.bookmarkOneGroup(group, folderName);
  }
};

TabGroupsManager.GroupsStore.prototype.renameStoredGroup = function ()
{
  var group = this.peek(document.popupNode.getAttribute("value") - 0);
  let oldName = group.name;
  let oldIcon = group.image;
  let data = {
    "name": oldName,
    "image": oldIcon
  };

  window.openDialog("chrome://tabgroupsmanager/content/GroupSettingsDialog.xul", "TabGroupsManagerGroupSettingsDialog", "chrome,modal,dialog,centerscreen,resizable", data);
  if (data.name != null)
  {
    group.name = data.name;
  }
  if (data.image != null)
  {
    group.image = data.image;
  }
};

TabGroupsManager.GroupsStore.prototype.bookmarkOneGroup = function (group, folderName, parentFolder)
{
  var places = Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Ci.nsINavBookmarksService);
  if (!folderName)
  {
    folderName = "untitled";
  }
  if (!parentFolder)
  {
    parentFolder = places.bookmarksMenuFolder;
  }
  var newFolderId = places.createFolder(parentFolder, folderName, places.DEFAULT_INDEX);
  if (group.tabs && group.tabs.length)
  {
    for (var i = 0; i < group.tabs.length; i++)
    {
      try
      {
        var tabData = JSON.parse(group.tabs[i]);
        var uri = TabGroupsManager.utils.createNewNsiUri(tabData.entries[tabData.index - 1].url);
        var title = tabData.entries[tabData.index - 1].title;
        places.insertBookmark(newFolderId, uri, places.DEFAULT_INDEX, title);
      }
      catch (e)
      {}
    }
  }
};
