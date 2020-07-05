/*jshint browser: true, devel: true */
/*eslint-env browser */

/* globals TabGroupsManager, TabGroupsManagerJsm */

TabGroupsManager.KeyboardShortcut = function()
{
  this.keyset = null;
  this.setKeyBind();
};

TabGroupsManager.KeyboardShortcut.prototype.setKeyBind = function()
{
  try
  {
    this.removeKeybind();
    var keyBind = this.readKeyBindJson();
    this.deleteDuplicatedKeyBind(keyBind);
    this.setMyKeyBind(keyBind);
  }
  catch (e)
  {
    TabGroupsManagerJsm.displayError.alertErrorIfDebug(e);
  }
};

TabGroupsManager.KeyboardShortcut.prototype.removeKeybind = function()
{
  if (this.keyset)
  {
    for (var i = this.keyset.childNodes.length - 1; i >= 0; i--)
    {
      this.keyset.removeChild(this.keyset.childNodes[i]);
    }
    this.keyset.parentNode.removeChild(this.keyset);
    this.keyset = null;
  }
};

TabGroupsManager.KeyboardShortcut.prototype.readKeyBindJson = function()
{
  let keyBindTmp = JSON.parse(TabGroupsManager.preferences.keyBindJson);
  let keyBind = new Array();
  for (var i = 0; i < keyBindTmp.length; i++)
  {
    if (keyBindTmp[i][0] && keyBindTmp[i][1])
    {
      let splitKey = keyBindTmp[i][0].split(/ *\| */);
      if (splitKey.length > 1 && splitKey[1] != "")
      {
        let keyBindOne = {};
        keyBind.push(keyBindOne);
        keyBindOne.keycode = "VK_" + splitKey[1];
        keyBindOne.modifiers = ((-1 != splitKey[0].indexOf("c") ? "control " : "") + (-1 != splitKey[0].indexOf("s") ? "shift " : "") + (-1 != splitKey[0].indexOf("a") ? "alt " : "") + (-1 != splitKey[0].indexOf("m") ? "meta " : "")).replace(/ $/, "");
        keyBindOne.code = keyBindTmp[i][1];
        if (keyBindTmp[i].length > 2)
        {
          keyBindOne.params = keyBindTmp[i].slice(2);
        }
      }
    }
  }
  return keyBind;
};

TabGroupsManager.KeyboardShortcut.prototype.deleteDuplicatedKeyBind = function(keyBind)
{
  if (TabGroupsManager.preferences.keyBindOverride)
  {
    var keysetList = document.getElementsByTagName("keyset");
    for (var i = 0; i < keysetList.length; i++)
    {
      for (var j = 0; j < keysetList[i].childNodes.length; j++)
      {
        var oldKeyBind = keysetList[i].childNodes[j];
        var modifiersTmp = oldKeyBind.getAttribute("modifiers");
        var modifiers = (modifiersTmp.match(/control|accel/i) ? "control " : "" + modifiersTmp.match(/shift/i) ? "shift " : "" + modifiersTmp.match(/alt|access/i) ? "alt " : "" + modifiersTmp.match(/meta/i) ? "meta " : "").replace(/ $/, "");
        var keycode = oldKeyBind.getAttribute("keycode").toUpperCase();
        if (!keycode)
        {
          keycode = "VK_" + oldKeyBind.getAttribute("key").toUpperCase();
        }
        for (var k = 0; k < keyBind.length; k++)
        {
          if (keyBind[k].modifiers == modifiers && keyBind[k].keycode == keycode)
          {
            oldKeyBind.setAttribute("disabled", true);
          }
        }
      }
    }
  }
};

TabGroupsManager.KeyboardShortcut.prototype.setMyKeyBind = function(keyBind)
{
  this.keyset = document.documentElement.appendChild(document.createElement("keyset"));
  for (var i = 0; i < keyBind.length; i++)
  {
    var key = this.keyset.appendChild(document.createElement("key"));
    key.setAttribute("modifiers", keyBind[i].modifiers);
    if (keyBind[i].keycode.length > 4)
    {
      key.setAttribute("keycode", keyBind[i].keycode);
    }
    else
    {
      key.setAttribute("key", keyBind[i].keycode.substr(3));
    }

    //key.setAttribute("oncommand","TabGroupsManager.keyboardShortcut.onCommand( event );");
    key.addEventListener("command", function(event)
    {
      TabGroupsManager.keyboardShortcut.onCommand(event);
    }, false);

    key.commandCode = keyBind[i].code;
    if (keyBind[i].params)
    {
      key.commandParams = keyBind[i].params.slice(0);
    }
  }
};

TabGroupsManager.KeyboardShortcut.prototype.onCommand = function(event)
{
  switch (event.target.commandCode)
  {
  case 0:
    TabGroupsManager.command.OpenNewGroup();
    break;
  case 1:
    TabGroupsManager.command.OpenNewGroupActive();
    break;
  case 2:
    TabGroupsManager.command.OpenNewGroupRename();
    break;
  case 3:
    TabGroupsManager.command.OpenNewGroupRenameActive();
    break;
  case 4:
    TabGroupsManager.command.OpenNewGroupHome();
    break;
  case 5:
    TabGroupsManager.command.OpenNewGroupHomeActive();
    break;
  case 10:
    TabGroupsManager.command.SleepActiveGroup();
    break;
  case 11:
    TabGroupsManager.command.RestoreLatestSleepedGroup();
    break;
  case 12:
    TabGroupsManager.command.SleepingGroupList();
    break;
  case 20:
    TabGroupsManager.command.CloseActiveGroup();
    break;
  case 21:
    TabGroupsManager.command.RestoreLatestClosedGroup();
    break;
  case 22:
    TabGroupsManager.command.ClosedGroupList();
    break;
  case 30:
    TabGroupsManager.command.SuspendActiveGroup();
    break;
  case 40:
    TabGroupsManager.command.SelectLeftGroup();
    break;
  case 41:
    TabGroupsManager.command.SelectRightGroup();
    break;
  case 42:
    TabGroupsManager.command.SelectLastGroup();
    break;
  case 43:
    TabGroupsManager.command.SelectNthGroup(event.target.commandParams[0] - 1);
    break;
  case 44:
    TabGroupsManager.command.SelectLeftTabInGroup();
    break;
  case 45:
    TabGroupsManager.command.SelectRightTabInGroup();
    break;
  case 46:
    TabGroupsManager.command.SelectLastTabInGroup();
    break;
  case 47:
    TabGroupsManager.command.SelectNthTabInGroup(event.target.commandParams[0] - 1);
    break;
  case 50:
    TabGroupsManager.command.DisplayHideGroupBar();
    break;
  case 60:
    TabGroupsManager.command.ActiveGroupMenu();
    break;
  case 61:
    TabGroupsManager.command.GroupBarMenu();
    break;
  }
};
