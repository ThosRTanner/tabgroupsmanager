/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.KeyboardState = function ()
{
  try
  {
    this.fCtrlKey = false;
    this.fShiftKey = false;
    this.fAltKey = false;
    this.fMetaKey = false;
    this.eventObject = null;
    this.__defineGetter__("ctrlKey", this.getCtrlKey);
    this.__defineGetter__("shiftKey", this.getShiftKey);
    this.__defineGetter__("altKey", this.getAltKey);
    this.__defineGetter__("metaKey", this.getMetaKey);
    this.__defineGetter__("mouseButton", this.mouseButton);
    this.createEventListener();
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.KeyboardState.prototype.createEventListener = function ()
{
  window.addEventListener("click", this, true);
  window.addEventListener("mousedown", this, true);
  window.addEventListener("mouseup", this, true);
  window.addEventListener("keydown", this, true);
  window.addEventListener("keyup", this, true);
  window.addEventListener("keypress", this, true);
};

TabGroupsManager.KeyboardState.prototype.destroyEventListener = function ()
{
  window.removeEventListener("click", this, true);
  window.removeEventListener("mousedown", this, true);
  window.removeEventListener("mouseup", this, true);
  window.removeEventListener("keydown", this, true);
  window.removeEventListener("keyup", this, true);
  window.removeEventListener("keypress", this, true);
};

TabGroupsManager.KeyboardState.prototype.handleEvent = function (event)
{
  switch (event.type)
  {
  case "click":
  case "mousedown":
  case "mouseup":
  case "keydown":
  case "keyup":
    this.getModifierKeys(event);
    break;
  case "keypress":
    this.onKeyPress(event);
    break;
  }
};

TabGroupsManager.KeyboardState.prototype.onKeyPress = function (event)
{
  if (event.keyCode == event.DOM_VK_TAB && !event.altKey && this.isAccelKeyDown(event))
  {
    if (event.shiftKey)
    {
      switch (TabGroupsManager.preferences.ctrlTab)
      {
      case 0:
        TabGroupsManager.allGroups.selectedGroup.selectLeftLoopTabInGroup();
        break;
      case 1:
        TabGroupsManager.allGroups.selectRightGroup();
        break;
      default:
        return;
      }
    }
    else
    {
      switch (TabGroupsManager.preferences.ctrlTab)
      {
      case 0:
      case 1:
        TabGroupsManager.allGroups.selectedGroup.selectRightLoopTabInGroup();
        break;
      default:
        return;
      }
    }
    event.preventDefault();
    event.stopPropagation();
  }
};

TabGroupsManager.KeyboardState.prototype.selectObject = function ()
{
  if (this.eventObject)
  {
    return this.eventObject;
  }
  else if (("easyDragToGo" in window) && window.easyDragToGo.onDropEvent)
  {
    return window.easyDragToGo.onDropEvent;
  }
  return null;
};

TabGroupsManager.KeyboardState.prototype.getCtrlKey = function ()
{
  var object = this.selectObject();
  return object ? object.ctrlKey : this.fCtrlKey;
};

TabGroupsManager.KeyboardState.prototype.getShiftKey = function ()
{
  var object = this.selectObject();
  return object ? object.shiftKey : this.fShiftKey;
};

TabGroupsManager.KeyboardState.prototype.getAltKey = function ()
{
  var object = this.selectObject();
  return object ? object.altKey : this.fAltKey;
};

TabGroupsManager.KeyboardState.prototype.getMetaKey = function ()
{
  var object = this.selectObject();
  return object ? object.metaKey : this.fMetaKey;
};

TabGroupsManager.KeyboardState.prototype.mouseButton = function ()
{
  var eventObject = this.selectObject();
  if (!eventObject)
  {
    return null;
  }
  return eventObject.button;
};

TabGroupsManager.KeyboardState.prototype.getModifierKeys = function (event)
{
  try
  {
    if (undefined != event.ctrlKey) this.fCtrlKey = event.ctrlKey;
    if (undefined != event.shiftKey) this.fShiftKey = event.shiftKey;
    if (undefined != event.altKey) this.fAltKey = event.altKey;
    if (undefined != event.metaKey) this.fMetaKey = event.metaKey;
  }
  catch (e)
  {}
};

TabGroupsManager.KeyboardState.prototype.isAccelKeyDown = function (event)
{
  return (TabGroupsManager.preferences.isMac ? event.metaKey : event.ctrlKey);
};
