// Copyright 2015 Google Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


/**
 * @fileoverview This module is used by message.html to load the correct
 * texts into the message template.
 */


window.addEventListener("load", function() {
  var link_target =
      "https://chrome.google.com/webstore/detail/" +
      "protect-my-choices/hdgloanjhdcenjgiafkpbehddcnonlic";

  // Set the title of the page to the extension name.
  document.title = chrome.i18n.getMessage("extension_name");

  // We expect that the message index is provided after a hash,
  // i.e. "message.html#<index>".
  var index = window.location.hash.split("#").slice(-1)[0];

  // Insert the translations of header, main paragraph of text,
  // link, and footer, if they exist. The IDs of the respective elements
  // are "header", "text", "link", and "foot". The translation keys are
  // expected to be named the same, with the index added as a suffix.
  var header = chrome.i18n.getMessage("header" + index);
  var text = chrome.i18n.getMessage("text" + index);
  var link = chrome.i18n.getMessage("link" + index);
  var foot = chrome.i18n.getMessage("foot" + index);

  document.querySelector("h1").innerText = header || "";
  document.getElementById("text").innerText = text || "";

  if (link) {
    // Make the link an anchor.
    var anchor = document.createElement("a");
    anchor.innerText = link || "";
    anchor.setAttribute("href", link_target);

    // Wrap the anchor in brackets.
    var link_div = document.getElementById("link");
    link_div.appendChild(document.createTextNode("[ "));
    link_div.appendChild(anchor);
    link_div.appendChild(document.createTextNode(" ]"));
  }

  document.querySelector("footer").innerText = foot || "";
});

