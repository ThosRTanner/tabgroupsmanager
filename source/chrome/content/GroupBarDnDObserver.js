
TabGroupsManager.GroupBarDnDObserver = function(aSupportDnD)
{
  try
  {
    this.groupOrderChangeMargin = 30;
    this.supportDnD = aSupportDnD;
    this.scrollbox = document.getElementById("TabGroupsManagerGroupBarScrollbox");
    this.createEventListener();
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.GroupBarDnDObserver.prototype.createEventListener = function()
{
  TabGroupsManager.xulElements.groupBar.addEventListener("dragenter", this, false);
  TabGroupsManager.xulElements.groupBar.addEventListener("dragover", this, false);
  TabGroupsManager.xulElements.groupBar.addEventListener("dragleave", this, false);
  TabGroupsManager.xulElements.groupBar.addEventListener("drop", this, false);
};

TabGroupsManager.GroupBarDnDObserver.prototype.destroyEventListener = function()
{
  TabGroupsManager.xulElements.groupBar.removeEventListener("dragenter", this, false);
  TabGroupsManager.xulElements.groupBar.removeEventListener("dragover", this, false);
  TabGroupsManager.xulElements.groupBar.removeEventListener("dragleave", this, false);
  TabGroupsManager.xulElements.groupBar.removeEventListener("drop", this, false);
};

TabGroupsManager.GroupBarDnDObserver.prototype.handleEvent = function(event)
{
  switch (event.type)
  {
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
  }
};

TabGroupsManager.GroupBarDnDObserver.prototype.checkPointInRect = function(point, rect)
{
  return (rect[0] <= point[0] && point[0] < rect[2] && rect[1] <= point[1] && point[1] < rect[3]);
};

TabGroupsManager.GroupBarDnDObserver.prototype.onDragOver = function(event, draggedTab)
{
  this.supportDnD.hideAll();
  if (event.originalTarget == document.getElementById("TabGroupsManagerGroupBarDropPlus"))
  {
    return;
  }
  TabGroupsManager.groupBarDispHide.dispGroupBar = true;
  var session = Cc["@mozilla.org/widget/dragservice;1"].getService(Ci.nsIDragService).getCurrentSession();
  if (event.originalTarget.className == "autorepeatbutton-up")
  {
    this.scrollbox.scrollByPixels(-20);
  }
  else if (event.originalTarget.className == "autorepeatbutton-down")
  {
    this.scrollbox.scrollByPixels(+20);
  }
  if (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "application/x-tabgroupsmanager-grouptab"))
  {
    var groupTab = this.supportDnD.getDragElementByTagName(session.sourceNode, "tab");
    if (groupTab)
    {
      var firstGroupTab = TabGroupsManager.allGroups.firstChild;
      var lastGroupTab = TabGroupsManager.allGroups.lastChild;
      var firstRect = firstGroupTab.getBoundingClientRect();
      var lastRect = lastGroupTab.getBoundingClientRect();
      var firstLeftRect = [firstRect.left - this.groupOrderChangeMargin, firstRect.top, firstRect.left, firstRect.bottom];
      var lastRightRect = [lastRect.right, lastRect.top, lastRect.right + this.groupOrderChangeMargin, lastRect.bottom];
      var dropPoint = [event.clientX, event.clientY];
      if (groupTab.parentNode == TabGroupsManager.allGroups.groupbar &&
        (
          !event.ctrlKey &&
          !(this.checkPointInRect(dropPoint, firstLeftRect) && groupTab != firstGroupTab) &&
          !(this.checkPointInRect(dropPoint, lastRightRect) && groupTab != lastGroupTab)
        )
      )
      {
        let rect = groupTab.getBoundingClientRect();
        if (event.shiftKey)
        {
          this.supportDnD.setSuspendPositionX((rect.left + rect.right) / 2);
        }
        else
        {
          this.supportDnD.setZZZPositionX((rect.left + rect.right) / 2);
        }
      }
      else
      {
        xPos = (event.clientX < firstRect.left) ? firstRect.left : lastRect.right;
        if (event.ctrlKey)
        {
          this.supportDnD.setPlusPositionX(xPos);
        }
        else
        {
          this.supportDnD.setAllowPositionX(xPos);
        }
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
      if (tab.group != event.target.group)
      {
        this.supportDnD.setPlusOPositionX(TabGroupsManager.allGroups.groupbar.lastChild.getBoundingClientRect().right, event.ctrlKey);
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.effectAllowed = "all";
      }
    }
  }
  else if (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/x-moz-url"))
  {
    this.supportDnD.setPlusOPositionX(TabGroupsManager.allGroups.groupbar.lastChild.getBoundingClientRect().right);
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "all";
  }
  else if (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/plain"))
  {
    this.supportDnD.setPlusOPositionX(TabGroupsManager.allGroups.groupbar.lastChild.getBoundingClientRect().right);
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.effectAllowed = "all";
  }
};

TabGroupsManager.GroupBarDnDObserver.prototype.onDragLeave = function(event)
{
  this.supportDnD.hideAll();
};

TabGroupsManager.GroupBarDnDObserver.prototype.onDrop = function(event, draggedTab)
{
  this.supportDnD.hideAllNow();
  var session = Cc["@mozilla.org/widget/dragservice;1"].getService(Ci.nsIDragService).getCurrentSession();
  if (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "application/x-tabgroupsmanager-grouptab"))
  {
    var groupTab = this.supportDnD.getDragElementByTagName(session.sourceNode, "tab");
    if (groupTab)
    {
      var firstGroupTab = TabGroupsManager.allGroups.firstChild;
      var lastGroupTab = TabGroupsManager.allGroups.lastChild;
      var firstRect = firstGroupTab.getBoundingClientRect();
      var lastRect = lastGroupTab.getBoundingClientRect();
      var firstLeftRect = [firstRect.left - this.groupOrderChangeMargin, firstRect.top, firstRect.left, firstRect.bottom];
      var lastRightRect = [lastRect.right, lastRect.top, lastRect.right + this.groupOrderChangeMargin, lastRect.bottom];
      var dropPoint = [event.clientX, event.clientY];
      if (groupTab.parentNode == TabGroupsManager.allGroups.groupbar)
      {
        if (event.ctrlKey)
        {
          let insertPos = (event.clientX < firstRect.left) ? 0 : null;
          TabGroupsManager.allGroups.changeGroupOrderInsertBefore(groupTab.group, insertPos, event.ctrlKey);
        }
        else if (this.checkPointInRect(dropPoint, firstLeftRect) && groupTab != firstGroupTab)
        {
          TabGroupsManager.allGroups.changeGroupOrderInsertBefore(groupTab.group, 0, event.ctrlKey);
        }
        else if (this.checkPointInRect(dropPoint, lastRightRect) && groupTab != lastGroupTab)
        {
          TabGroupsManager.allGroups.changeGroupOrderInsertBefore(groupTab.group, null, event.ctrlKey);
        }
        else
        {
          if (event.shiftKey)
          {
            groupTab.group.suspended = !groupTab.group.suspended;
          }
          else
          {
            groupTab.group.sleepGroup();
          }
        }
      }
      else
      {
        if (event.clientX < firstRect.left)
        {
          TabGroupsManager.allGroups.moveGroupToOtherWindow(groupTab, 0, event.ctrlKey);
        }
        else
        {
          TabGroupsManager.allGroups.moveGroupToOtherWindow(groupTab, null, event.ctrlKey);
        }
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
          TabGroupsManager.allGroups.moveTabToGroupInSameWindow(tab, null, event.ctrlKey);
        }, 100);
      }
      else
      {
        setTimeout(function ()
        {
          TabGroupsManager.allGroups.moveTabToGroupInOtherWindow(tab, null, event.ctrlKey);
        }, 100);
      }
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }
  else if (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/x-moz-place"))
  {
    var node = session.sourceNode.node;
    if (node)
    {
      if (PlacesUtils.nodeIsBookmark(node))
      {
        TabGroupsManager.places.openInNewGroup(node);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      else if (PlacesUtils.nodeIsFolder(node))
      {
        TabGroupsManager.places.allOpenInNewGroup(node);
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }
  }
  else if (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/x-moz-url"))
  {
    var data = event.dataTransfer.getData("text/x-moz-url");
    var splitData = data.split(/\r?\n/);
    var url = splitData[0];
    var tab = TabGroupsManager.overrideMethod.gBrowserAddTab(url);
    var group = TabGroupsManager.allGroups.openNewGroup(tab);
    if (splitData.length > 1 && splitData[1] != "")
    {
      group.autoRename(splitData[1]);
    }
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  else if (TabGroupsManager.utils.dataTransferTypesContains(event.dataTransfer, "text/plain"))
  {
    let text = event.dataTransfer.getData("text/plain");
    let splitText = text ? text.split(/\r?\n/)[0] : "";
    if (splitText.match(/s?https?:\/\/[-_.!~*'()a-zA-Z0-9;\/?:\@&=+\$,%#]+/))
    {
      TabGroupsManager.allGroups.openNewGroup(TabGroupsManager.overrideMethod.gBrowserAddTab(RegExp.lastMatch));
    }
    else
    {
      let group = TabGroupsManager.allGroups.openNewGroup(null);
      group.renameByText(text);
    }
    event.preventDefault();
    event.stopPropagation();
    return;
  }
};
