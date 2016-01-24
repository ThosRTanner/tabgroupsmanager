//setup all listener
addEventListener("contextmenu", contextMenuContentAction);

//not yet needed
/*const msgName = "sendToFrame";
addMessageListener(msgName, receiveMessage);

function receiveMessage(msg) {
    if (msg.name != msgName) return;
		
	switch (msg.data.msgType)
	{
		case "testmessage":
			break;
	}
}*/

//send the context menu target link to chrome window
function contextMenuContentAction(event) {
	sendAsyncMessage("sendToTGMChrome", { msgType: 'linkTarget', href: event.target.href } );	
};