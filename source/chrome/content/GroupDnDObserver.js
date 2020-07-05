/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.GroupDnDObserver = function(aSupportDnD)
{
  try
  {
    this.supportDnD = aSupportDnD;
    this.createEventListener();
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.GroupDnDObserver.prototype.createEventListener = function()
{
  var _this = this;
  var groupBar = document.getElementById("TabGroupsManagerGroupbar");
  groupBar.addEventListener("dragstart", this, false);
  groupBar.addEventListener("dragenter", this, false);
  groupBar.addEventListener("dragover", this, false);
  groupBar.addEventListener("dragleave", this, false);
  groupBar.addEventListener("drop", this, false);
  groupBar.addEventListener("dragend", this, false);
};

TabGroupsManager.GroupDnDObserver.prototype.destroyEventListener = function()
{
  var _this = this;
  var groupBar = document.getElementById("TabGroupsManagerGroupbar");
  groupBar.removeEventListener("dragstart", this, false);
  groupBar.removeEventListener("dragenter", this, false);
  groupBar.removeEventListener("dragover", this, false);
  groupBar.removeEventListener("dragleave", this, false);
  groupBar.removeEventListener("drop", this, false);
  groupBar.removeEventListener("dragend", this, false);
};

TabGroupsManager.GroupDnDObserver.prototype.handleEvent = function(event)
{
  switch (event.type)
  {
  case "dragstart":
    this.onDragStart(event);
    break;
  case "dragenter":
  case "dragover":
    this.onDragOver(event);
    break;
  case "dragleave":
    this.onDragLeave(event);
    break;
  case "drop":
    this.onDrop(event);
    break;
  case "dragend":
    this.onDragEnd(event);
    break;
  }
};

TabGroupsManager.GroupDnDObserver.prototype.onDragStart = function(event)
{
  event.dataTransfer.setDragImage(event.target, event.target.clientWidth / 2, -20);
  event.dataTransfer.setData("application/x-tabgroupsmanager-grouptab", "GroupTab");
  this.dragStartX = event.screenX;
  this.dragStartY = event.screenY;
};

TabGroupsManager.GroupDnDObserver.prototype.onDragOver = function(event, draggedTab)
{
  this.supportDnD.hideAll();
  if (event.target.parentNode != TabGroupsManager.allGroups.groupbar)
  {
    return;
  }
  var session = Cc["@mozilla.org/widget/dragservice;1"].getService(Ci.nsIDragService).getCurrentSession();
  if (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "application/x-tabgroupsmanager-grouptab"))
  {
    var groupTab = this.supportDnD.getDragElementByTagName(session.sourceNode, "tab");
    if (groupTab)
    {
      if (event.ctrlKey)
      {
        this.supportDnD.setPlusPositionX(TabGroupsManager.allGroups.dropPositionX(null, event.target, event.clientX));
      }
      else if (groupTab != event.target)
      {
        this.supportDnD.setAllowPositionX(TabGroupsManager.allGroups.dropPositionX(groupTab, event.target, event.clientX));
      }
      else
      {
        this.supportDnD.hideAll();
      }
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.effectAllowed = "all";
    }
  }
  else if ((TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "application/x-moz-tabbrowser-tab")) || (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/x-moz-text-internal")))
  {
    var tab = draggedTab || this.supportDnD.getDragElementByTagName(session.sourceNode, "tab");
    if (tab)
    {
      if (event.ctrlKey)
      {
        this.supportDnD.setPlusPositionX((event.target.getBoundingClientRect().left + event.target.getBoundingClientRect().right) / 2);
      }
      else if (tab.group != event.target.group)
      {
        this.supportDnD.setAllowPositionX((event.target.getBoundingClientRect().left + event.target.getBoundingClientRect().right) / 2);
      }
      else
      {
        this.supportDnD.hideAll();
      }
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.effectAllowed = "all";
    }
  }
  else if (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/x-moz-url"))
  {
    this.supportDnD.setPlusPositionX((event.target.getBoundingClientRect().left + event.target.getBoundingClientRect().right) / 2);
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "all";
  }
  else if (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/plain"))
  {
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "all";
  }
};

TabGroupsManager.GroupDnDObserver.prototype.onDragLeave = function(event)
{
  this.supportDnD.hideAll();
  event.stopPropagation();
};

TabGroupsManager.GroupDnDObserver.prototype.onDragEnd = function(event)
{
  if (event.dataTransfer.dropEffect == "none")
  {
    var groupTab = event.target;
    if (groupTab)
    {
      if (!window.gSingleWindowMode)
      {
        var isCopy = event.ctrlKey || TabGroupsManager.keyboardState.ctrlKey;
        groupTab.group.busy = groupTab.group.busy || !isCopy;
        window.openDialog("chrome://browser/content/browser.xul", "_blank", "chrome,all,dialog=no", "about:blank", "TabGroupsManagerNewWindowWithGroup", groupTab, isCopy);
      }
    }
  }
};

TabGroupsManager.GroupDnDObserver.prototype.onDrop = function(event, draggedTab)
{
  this.supportDnD.hideAllNow();
  var session = Cc["@mozilla.org/widget/dragservice;1"].getService(Ci.nsIDragService).getCurrentSession();
  if (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "application/x-tabgroupsmanager-grouptab"))
  {
    var groupTab = this.supportDnD.getDragElementByTagName(session.sourceNode, "tab");
    if (groupTab)
    {
      if (groupTab.parentNode == TabGroupsManager.allGroups.groupbar)
      {
        TabGroupsManager.allGroups.moveGroupToSameWindow(groupTab, event, event.ctrlKey);
      }
      else
      {
        TabGroupsManager.allGroups.moveGroupToOtherWindow(groupTab, event, event.ctrlKey);
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }
  else if ((TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "application/x-moz-tabbrowser-tab")) || (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/x-moz-text-internal")))
  {
    var tab = draggedTab || this.supportDnD.getDragElementByTagName(session.sourceNode, "tab");
    if (tab)
    {
      if (tab.parentNode == gBrowser.tabContainer)
      {
        setTimeout(function ()
        {
          TabGroupsManager.allGroups.moveTabToGroupInSameWindow(tab, event.target.group, event.ctrlKey);
        }, 100);
      }
      else
      {
        setTimeout(function ()
        {
          TabGroupsManager.allGroups.moveTabToGroupInOtherWindow(tab, event.target.group, event.ctrlKey);
        }, 100);
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }
  else if (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/x-moz-url"))
  {
    var data = event.dataTransfer.getData("text/x-moz-url");
    var splitData = data.split(/\r?\n/);
    var tab = TabGroupsManager.overrideMethod.gBrowserAddTab(splitData[0]);
    event.target.group.addTab(tab);
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  else if (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/plain"))
  {
    let text = event.dataTransfer.getData("text/plain");
    let group = event.target.group;
    let splitText = text ? text.split(/\r?\n/)[0] : "";
    if (splitText.match(/s?https?:\/\/[-_.!~*'()a-zA-Z0-9;\/?:\@&=+\$,%#]+/))
    {
      let tab = TabGroupsManager.overrideMethod.gBrowserAddTab(RegExp.lastMatch);
      group.addTab(tab);
    }
    else
    {
      group.renameByText(text);
    }
    event.preventDefault();
    event.stopPropagation();
    return;
  }
};

