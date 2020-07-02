/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.Places = function ()
{
  try
  {
    this.bookmarksService = Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Ci.nsINavBookmarksService);
    this.allOpenInNewGroupString = document.getElementById("TabGroupsManagerPlacesAllOpenInNewGroup").label;
    this.allOpenInSelectedGroupString = document.getElementById("TabGroupsManagerPlacesAllOpenInSelectedGroup").label;
    let modifyList = ["bookmarksBarContent", "PlacesToolbar", "bookmarksMenuPopup", "bookmarks-menu-button", "PlacesChevron"];
    for (let i = 0; i < modifyList.length; i++)
    {
      let element = document.getElementById(modifyList[i]);
      if (element)
      {
        element.addEventListener("click", this, true);
        element.addEventListener("dblclick", this, true);
      }
    }
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.Places.prototype.addAllOpenInGroupMenuitem = function (target)
{
  target._openAllInNewGroup = document.createElement("menuitem");
  target._openAllInNewGroup.setAttribute("id", "TabGroupsManagerMenuitemAllOpenInNewGroup");

  //target._openAllInNewGroup.setAttribute("oncommand","TabGroupsManager.places.menuitemAllOpenInNewGroupCommand( event );");
  target._openAllInNewGroup.addEventListener("command", function (event)
  {
    TabGroupsManager.places.menuitemAllOpenInNewGroupCommand(event);
  }, false);

  //target._openAllInNewGroup.setAttribute("onclick","TabGroupsManager.places.menuitemAllOpenInNewGroupClick( event );");
  target._openAllInNewGroup.addEventListener("click", function (event)
  {
    TabGroupsManager.places.menuitemAllOpenInNewGroupClick(event);
  }, false);

  target._openAllInNewGroup.setAttribute("label", this.allOpenInNewGroupString);
  target.appendChild(target._openAllInNewGroup);
  target._openAllInSelectedGroup = document.createElement("menuitem");
  target._openAllInSelectedGroup.setAttribute("id", "TabGroupsManagerMenuitemAllOpenInSelectedGroup");

  //target._openAllInSelectedGroup.setAttribute("oncommand","TabGroupsManager.places.menuitemAllOpenInSelectedGroupCommand( event );");
  target._openAllInSelectedGroup.addEventListener("command", function (event)
  {
    TabGroupsManager.places.menuitemAllOpenInSelectedGroupCommand(event);
  }, false);

  //target._openAllInSelectedGroup.setAttribute("onclick","TabGroupsManager.places.menuitemAllOpenInSelectedGroupClick( event );");
  target._openAllInSelectedGroup.addEventListener("click", function (event)
  {
    TabGroupsManager.places.menuitemAllOpenInSelectedGroupClick(event);
  }, false);

  target._openAllInSelectedGroup.setAttribute("label", this.allOpenInSelectedGroupString);
  target.appendChild(target._openAllInSelectedGroup);
};

TabGroupsManager.Places.prototype.removeAllOpenInGroupMenuitem = function (target)
{
  target.removeChild(target._openAllInNewGroup);
  target.removeChild(target._openAllInSelectedGroup);
  delete target._openAllInNewGroup;
  delete target._openAllInSelectedGroup;
};

TabGroupsManager.Places.prototype.menuitemAllOpenInNewGroupCommand = function (event)
{
  this.allOpenInNewGroup(event.target.parentNode.parentNode.node);
};

TabGroupsManager.Places.prototype.menuitemAllOpenInNewGroupClick = function (event)
{
  if (event.button == 1)
  {
    this.allOpenInNewGroup(event.target.parentNode.parentNode.node);
    event.preventDefault();
    event.stopPropagation();
  }
};

TabGroupsManager.Places.prototype.menuitemAllOpenInSelectedGroupCommand = function (event)
{
  this.allOpenInSelectedGroup(event.target.parentNode.parentNode.node);
};

TabGroupsManager.Places.prototype.menuitemAllOpenInSelectedGroupClick = function (event)
{
  if (event.button == 1)
  {
    this.allOpenInSelectedGroup(event.target.parentNode.parentNode.node);
    event.preventDefault();
    event.stopPropagation();
  }
};

TabGroupsManager.Places.prototype.handleEvent = function (event)
{
  switch (event.type)
  {
  case "click":
    this.onClick(event);
    break;
  case "dblclick":
    this.onDblClick(event);
    break;
  }
};

TabGroupsManager.Places.prototype.onClick = function (event)
{
  switch (event.button)
  {
  case 0:
    this.execBookmarkFolderClick(TabGroupsManagerJsm.globalPreferences.bookmarkFolderLClick, event);
    break;
  case 1:
    this.execBookmarkFolderClick(TabGroupsManagerJsm.globalPreferences.bookmarkFolderMClick, event);
    break;
  }
};

TabGroupsManager.Places.prototype.onDblClick = function (event)
{
  if (event.button == 0)
  {
    this.execBookmarkFolderClick(TabGroupsManagerJsm.globalPreferences.bookmarkFolderDblClick, event);
  }
};

TabGroupsManager.Places.prototype.execBookmarkFolderClick = function (no, event)
{
  if (no == -1)
  {
    return;
  }
  let result;
  if (no > 2)
  {
    result = this.allOpenInSelectedGroup(event.target._placesNode || event.target.node);
  }
  else if (no > 0)
  {
    result = this.allOpenInNewGroup(event.target._placesNode || event.target.node);
  }
  if (result)
  {
    if (no % 2 != 0)
    {
      for (let node = event.target.parentNode; node; node = node.parentNode)
      {
        if (node.localName == "menupopup")
        {
          node.hidePopup();
        }
      }
    }
    event.preventDefault();
    event.stopPropagation();
  }
};

TabGroupsManager.Places.prototype.openInNewGroup = function (bookmarkItem)
{
  var groupName = bookmarkItem.title;
  var icon = bookmarkItem.icon ? bookmarkItem.icon.spec : "";
  var newTab = TabGroupsManager.overrideMethod.gBrowserAddTab(bookmarkItem.uri);
  return TabGroupsManager.allGroups.openNewGroup(newTab, undefined, groupName, icon);
};

TabGroupsManager.Places.prototype.openInSelectedGroup = function (bookmarkItem)
{
  var group = this.openInNewGroup(bookmarkItem);
  TabGroupsManager.allGroups.selectedGroup = group;
};

TabGroupsManager.Places.prototype.allOpenInNewGroup = function (bookmarkFolder)
{
  if (!bookmarkFolder || !PlacesUtils.nodeIsFolder(bookmarkFolder))
  {
    return null;
  }
  bookmarkFolder = PlacesUtils.getFolderContents(bookmarkFolder.itemId).root;
  var count = 0;
  for (var i = 0; i < bookmarkFolder.childCount; i++)
  {
    if (PlacesUtils.nodeIsBookmark(bookmarkFolder.getChild(i)))
    {
      count++;
    }
  }
  if (count <= 0)
  {
    return null;
  }
  if (count > 10)
  {
    var message = TabGroupsManager.strings.getFormattedString("MenuItemAllOpenTooManyBookmarks", [count]);
    if (!window.confirm(message))
    {
      return null;
    }
  }
  var groupName = bookmarkFolder.title;
  var icon = bookmarkFolder.icon ? bookmarkItem.icon.spec : "";
  var group = TabGroupsManager.allGroups.openNewGroupCore(undefined, groupName, icon);
  for (var i = 0; i < bookmarkFolder.childCount; i++)
  {
    var bookmarkItem = bookmarkFolder.getChild(i);
    if (PlacesUtils.nodeIsBookmark(bookmarkItem))
    {
      let tab = TabGroupsManager.overrideMethod.gBrowserAddTab(bookmarkItem.uri);
      group.addTab(tab);
    }
  }
  return group;
};

TabGroupsManager.Places.prototype.allOpenInSelectedGroup = function (bookmarkFolder)
{
  var group = this.allOpenInNewGroup(bookmarkFolder);
  if (group)
  {
    group.setSelected();
  }
  return group;
};
