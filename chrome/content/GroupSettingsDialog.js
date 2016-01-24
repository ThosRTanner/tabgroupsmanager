Components.utils.import("resource://tabgroupsmanager/modules/TabGroupsManager.jsm");
var TabGroupsManagerGroupSettings=
{
  resultData:null,
  tab1:null,
  input_name:null,
  input_url:null,
  menuitemExcludeFolderLabel:null,
  dialogExcludeFolderLabel:null,
  dialogDefaultLabel:null,
  init:function(event){
    this.resultData=window.arguments[0];
    this.tab1=document.getElementById("tab1");
    this.input_name=document.getElementById("input_name");
    this.input_url=document.getElementById("input_url");
    this.input_name.value=this.resultData.name;
    this.tab1.setAttribute("label",this.resultData.name);
    this.input_url.value=this.resultData.image;
    this.tab1.setAttribute("image",this.resultData.image);
    this.menuitemExcludeFolderLabel=document.getElementById("TabGroupsManagerMenuitemExcludeFolderLabel").value;
    this.dialogExcludeFolderLabel=document.getElementById("TabGroupsManagerDialogExcludeFolderLabel").value.replace(/\\n/g,"\n");
    this.dialogDefaultLabel=document.getElementById("TabGroupsManagerDialogDefaultLabel").value.replace(/\\n/g,"\n");
    this.makeIconList();
    this.makeNameList();
  },
  makeNameList:function(){
    var parent=document.getElementById("input_name_list");
    var list1=TabGroupsManagerJsm.globalPreferences.groupNameRegistered;
    var list2=TabGroupsManagerJsm.globalPreferences.groupNameHistory;
    var flgmntNode=document.createDocumentFragment();
    for(let i=0;i<list1.length;i++){
      let menuitem=document.createElement("menuitem");
      menuitem.setAttribute("label",list1[i]);
      menuitem.setAttribute("image","resource://tabgroupsmanager/icons/circle/red.png");
      flgmntNode.appendChild(menuitem);
    }
    if(list1.length>0&&list2.length>0){
      let menuitem=document.createElement("menuseparator");
      flgmntNode.appendChild(menuitem);
    }
    for(let i=0;i<list2.length;i++){
      let menuitem=document.createElement("menuitem");
      menuitem.setAttribute("label",list2[i]);
      flgmntNode.appendChild(menuitem);
    }
    parent.appendChild(flgmntNode);
  },
  makeIconList:function(){
    let parent=document.getElementById("TabGroupsManagerIconList");
    for(let i=parent.childNodes.length-1;i>=0;i--){
      parent.removeChild(parent.childNodes[i]);
    }
    let iconFolders=TabGroupsManagerJsm.globalPreferences.jsonPrefToObject("localIconFilders");
    let flgmntNode=document.createDocumentFragment();
    for(let i=0;i<iconFolders.length;i++){
      let iconFolderName=iconFolders[i];
      let iconFolder=TabGroupsManagerJsm.folderLocation.makeNsIFileWrapperFromURL(iconFolderName);
      let row=document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul","row");
      row.setAttribute("align","top");
      flgmntNode.appendChild(row);
      let folderButton=document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul","button");
      folderButton.setAttribute("type","menu");
      folderButton.setAttribute("label",(0==iconFolderName.indexOf("resource://"))?"default":iconFolder.leafName);
      folderButton.setAttribute("tooltiptext",iconFolderName);
      folderButton.addEventListener("keydown",TabGroupsManagerFolderButtonEvent,false);
      row.appendChild(folderButton);
      let menupopup=document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul","menupopup");
      folderButton.appendChild(menupopup);
      let menuitem=document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul","menuitem");
      menuitem.setAttribute("label",this.menuitemExcludeFolderLabel);
      menuitem.setAttribute("oncommand","TabGroupsManagerGroupSettings.deleteIconFolder( event );");
      menupopup.appendChild(menuitem);
      let vbox=document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul","vbox");
      row.appendChild(vbox);
      this.makeIconListOneLine(vbox,iconFolder,iconFolderName);
    }
    parent.appendChild(flgmntNode);
  },
  makeIconListOneLine:function(vbox,folder,folderName){
    if(folder.exists){
      let files=folder.getArrayOfFileRegex(".*\.(:?png|gif|jpg|jpeg|ico)$");
      if(files.length>0){
        let hbox=document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul","hbox");
        hbox.setAttribute("align","center");
        vbox.appendChild(hbox);
        for(let j=0;j<files.length;j++){
          let menuitem=document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul","button");
          menuitem.setAttribute("label","");
          menuitem.setAttribute("imagewidth","16");
          menuitem.setAttribute("imageheight","16");
          menuitem.setAttribute("image",folderName+files[j].leafName);
          menuitem.setAttribute("class","tabgroupsmanager-button-flat-icon-only");
          menuitem.setAttribute("validate","never");
          menuitem.setAttribute("tooltiptext",files[j].leafName);
          menuitem.addEventListener("command",TabGroupsManagerIconButtonEvent,false);
          menuitem.addEventListener("keydown",TabGroupsManagerIconButtonEvent,false);
          hbox.appendChild(menuitem);
        }
      }
      let folders=folder.getArrayOfFolderRegex("^[^.]");
      for(var i=0;i<folders.length;i++){
        this.makeIconListOneLine(vbox,folders[i],folderName+folders[i].leafName+"/");
      }
    }
  },
  deleteIconFolder:function(event){
    let deleteFolder=event.target.parentNode.parentNode.getAttribute("tooltiptext");
    let message=deleteFolder+this.dialogExcludeFolderLabel;
    if(confirm(message)){
      let iconFolders=TabGroupsManagerJsm.globalPreferences.jsonPrefToObject("localIconFilders");
      let deleteIndex=iconFolders.indexOf(deleteFolder);
      if(deleteIndex>=0){
        iconFolders.splice(deleteIndex,1);
        TabGroupsManagerJsm.globalPreferences.objectToJsonPref("localIconFilders",iconFolders);
        this.makeIconList();
      }
    }
  },
  registerIconFolder:function(event){
    let nsIFilePicker=Components.interfaces.nsIFilePicker;
    let filePicker=Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);
    filePicker.init(window,"Select a Folder",nsIFilePicker.modeGetFolder);
    if(nsIFilePicker.returnOK==filePicker.show()){
      let url=TabGroupsManagerJsm.folderLocation.makeURLFromNsILocalFile(filePicker.file);
      let iconFolders=TabGroupsManagerJsm.globalPreferences.jsonPrefToObject("localIconFilders");
      iconFolders.push(url);
      TabGroupsManagerJsm.globalPreferences.objectToJsonPref("localIconFilders",iconFolders);
      this.makeIconList();
    }
  },
  defaultIconFolder:function(event){
    if(TabGroupsManagerJsm.globalPreferences.prefBranch.prefHasUserValue("localIconFilders")){
      if(confirm(this.dialogDefaultLabel)){
        TabGroupsManagerJsm.globalPreferences.prefBranch.clearUserPref("localIconFilders");
        this.makeIconList();
      }
    }
  },
  nameOnChange:function(event){
    this.tab1.setAttribute("label",this.input_name.value);
  },
  urlOnChange:function(event){
    this.tab1.setAttribute("image",this.input_url.value);
  },
  clearIconUrl:function(event){
    document.getElementById("input_url").value="";
    this.urlOnChange();
  },
  onAccept:function(event){
    this.resultData.name=this.input_name.value;
    this.resultData.image=this.input_url.value;
    return true;
  },
  onCancel:function(event){
    this.resultData.name=null;
    this.resultData.image=null;
    return true;
  },
};
var TabGroupsManagerFolderButtonEvent=
{
  handleEvent:function(event){
    switch(event.type){
      case"keydown":this.onKeydown(event);break;
    }
  },
  onKeydown:function(event){
    switch(event.keyCode){
      case event.DOM_VK_RIGHT:
        if(event.target.nextSibling.firstChild.firstChild){
          setTimeout(function(){event.target.nextSibling.firstChild.firstChild.focus();},0);
        }
      break;
      case event.DOM_VK_UP:
        if(event.target.parentNode.previousSibling){
          setTimeout(function(){event.target.parentNode.previousSibling.firstChild.focus();},0);
        }
      break;
      case event.DOM_VK_DOWN:
        if(event.target.parentNode.nextSibling){
          setTimeout(function(){event.target.parentNode.nextSibling.firstChild.focus();},0);
        }
      break;
    }
  },
};
var TabGroupsManagerIconButtonEvent=
{
  handleEvent:function(event){
    switch(event.type){
      case"command":this.onCommand(event);break;
      case"keydown":this.onKeydown(event);break;
    }
  },
  onCommand:function(event){
    var image=event.target.getAttribute("image");
    TabGroupsManagerGroupSettings.tab1.setAttribute("image",image);
    TabGroupsManagerGroupSettings.input_url.value=image;
  },
  onKeydown:function(event){
    switch(event.keyCode){
      case event.DOM_VK_UP:
        var button=event.target;
        var parent=button.parentNode;
        var previousParent=parent.previousSibling;
        if(!previousParent&&parent.parentNode.parentNode.previousSibling){
          previousParent=parent.parentNode.parentNode.previousSibling.childNodes[1].lastChild;
        }
        if(previousParent&&previousParent.tagName=="hbox"){
          let buttonIndex=0;
          for(let i=0;i<parent.childNodes.length;i++){
            if(parent.childNodes[i]==button){
              buttonIndex=Math.min(i,previousParent.childNodes.length-1);
              break;
            }
          }
          setTimeout(function(){previousParent.childNodes[buttonIndex].focus();},0);
        }else
          setTimeout(function(){button.focus();},0);
      break;
      case event.DOM_VK_DOWN:
        var button=event.target;
        var parent=button.parentNode;
        let nextParent=parent.nextSibling;
        if(!nextParent&&parent.parentNode.parentNode.nextSibling){
          nextParent=parent.parentNode.parentNode.nextSibling.childNodes[1].firstChild;
        }
        if(nextParent&&nextParent.tagName=="hbox"){
          let buttonIndex=0;
          for(let i=0;i<parent.childNodes.length;i++){
            if(parent.childNodes[i]==button){
              buttonIndex=Math.min(i,nextParent.childNodes.length-1);
              break;
            }
          }
          setTimeout(function(){nextParent.childNodes[buttonIndex].focus();},0);
        }else
          setTimeout(function(){button.focus();},0);
      break;
    }
  },
};