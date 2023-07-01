import "./styles.css";

import tinymceWordPasteFilter from "tinymce-word-paste-filter";
import dompurify from "dompurify";
import React, { PureComponent } from "react";
import ReactDOM from "react-dom";
import ReactDiffViewer from "react-diff-viewer";
import Prism from "prismjs";
import prettier from "prettier";
import prettierHTML from "prettier/parser-html";

const sanitizerPlugins = [
  {
    name: "original",
    description: "Original HTML",
    sanitizerMethod: (str) => {
      return str;
    }
  },
  {
    name: "tinymce",
    description: "TinyMCE Word Paste",
    sanitizerMethod: (str) => {
      return tinymceWordPasteFilter(str);
    }
  },
  {
    name: "dompurify",
    description: "DOMPurify (standard)",
    sanitizerMethod: (str) => {
      return dompurify.sanitize(str);
    }
  },
  {
    name: "dompurify-tjwhitelist",
    description: "DOMPurify (TJ whitelist)",
    sanitizerMethod: (str) => {
      // Tries to mimic rails-html-sanitizer config in TJ
      var config = {
        ALLOWED_TAGS: [
          "strong",
          "em",
          "b",
          "i",
          "p",
          "code",
          "pre",
          "tt",
          "samp",
          "kbd",
          "var",
          "sub",
          "sup",
          "dfn",
          "cite",
          "big",
          "small",
          "address",
          "hr",
          "br",
          "div",
          "span",
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "ul",
          "ol",
          "li",
          "dl",
          "dt",
          "dd",
          "abbr",
          "acronym",
          "a",
          "img",
          "blockquote",
          "del",
          "ins",
          "style",
          "table",
          "thead",
          "tbody",
          "tr",
          "th",
          "td",
          "font",
          "section",
          "u",
          "bdi"
        ],
        ALLOWED_ATTR: [
          "href",
          "src",
          "width",
          "height",
          "alt",
          "cite",
          "datetime",
          "title",
          "class",
          "name",
          "xml:lang",
          "abbr",
          "style",
          "color"
        ]
      };

      return dompurify.sanitize(str, config);
    }
  }
];

const framePlugins = [
  {
    name: "clean",
    description: "Clean iframe",
    injectMethod: (iframe, str) => {
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(str);
      iframe.contentWindow.document.close();
    }
  },
  {
    name: "redbase",
    description: "Red base style",
    injectMethod: (iframe, str) => {
      let iframeContent = `<html><body style="color: red;">${str}</body></html>`;
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(iframeContent);
      iframe.contentWindow.document.close();
    }
  },
  {
    name: "tjcss",
    description: "TJ CSS (prod)",
    injectMethod: (iframe, str) => {
      let iframeContent = `<html>
<link rel="stylesheet" media="all" href="https://assets.traveljoy.com/assets/application-75de3a6d6a109bfe23eb5ba934a0bf933b7802d2b829c7aa315662434a717048.css">
<body>
<div class="tab-pane active" id="trip-feed">
<div class="message adhoc-message"><div class="panel"><div class="panel-body">
${str}
</div></div></div></div>
</body>
</html>`;
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(iframeContent);
      iframe.contentWindow.document.close();
    }
  }
];

var previewers = [
  {
    name: "ogclean",
    description: "",
    sanitizers: ["original"],
    frame: "clean"
  },
  {
    name: "dompurifyTjwhitelistTjcss",
    description: "",
    sanitizers: ["original", "dompurify-tjwhitelist"],
    frame: "tjcss"
  },
  {
    name: "tinymceTjcss",
    description: "",
    sanitizers: ["original", "tinymce"],
    frame: "redbase"
  },
  {
    name: "dompurifyTjcss",
    description: "",
    sanitizers: ["original", "dompurify"],
    frame: "redbase"
  },
  {
    name: "dompurifyTjwhitelist",
    description: "",
    sanitizers: ["original", "dompurify-tjwhitelist"],
    frame: "redbase"
  }
];

class Sanitizers {
  constructor(plugins) {
    this.plugins = plugins;
  }
  description(sanitizerName) {
    return this.plugins.find((s) => s.name === sanitizerName).description;
  }
  sanitizerMethod(sanitizerName) {
    return this.plugins.find((s) => s.name === sanitizerName).sanitizerMethod;
  }
  sanitize(str, sanitizerName) {
    var sanitizerMethod = this.plugins.find((s) => s.name === sanitizerName)
      .sanitizerMethod;
    return sanitizerMethod(str);
  }
  sanitizeChain(str, sanitizerNameList) {
    let output = str;
    sanitizerNameList.forEach((sanitizerName) => {
      output = this.sanitize(output, sanitizerName);
    });
    return output;
  }
}

const TJSanitizers = new Sanitizers(sanitizerPlugins);

class Frames {
  constructor(plugins) {
    this.plugins = plugins;
  }

  description(frameName) {
    return this.plugins.find((f) => f.name === frameName).description;
  }
  injectMethod(frameName) {
    return this.plugins.find((f) => f.name === frameName).injectMethod;
  }
}

const TJFrames = new Frames(framePlugins);

class Previewer {
  constructor({ name, description, sanitizers, frame }) {
    this.name = name;
    this.description = description;
    this.sanitizerNameList = sanitizers;
    this.frameName = frame;
  }

  iframeId = () => `viewer-${this.name}`;
  containerId = () => `previewer-${this.name}`;

  renderSanitizedHTML(str) {
    return TJSanitizers.sanitizeChain(str, this.sanitizerNameList);
  }

  getSourceRawHTML() {
    const inputRawHTML = document.getElementById("inputRawHTML");
    return inputRawHTML.value;
  }

  updatePreviewer() {
    console.log(`Updating previewer: ${this.name}`);
    let previewIframe = document.getElementById(this.iframeId());
    console.log(`* Preview iframe: #${this.iframeId()}`);
    let iframeInjectMethod = TJFrames.injectMethod(this.frameName);
    console.log(`* Inject method: ${iframeInjectMethod}`);

    iframeInjectMethod(
      previewIframe,
      this.renderSanitizedHTML(this.getSourceRawHTML())
    );
  }

  renderOutputIframe = () =>
    `<div class="previewer" id="${this.containerId()}" data-previewer-name="${
      this.name
    }">
<div class="controls">
<span class="description sanitizerChain">🧼 ${this.renderSanitizerChainDescription()}</span>
<span class="description frame">🖼 ${this.renderFrameDescription()}</span>
<button class="action good copyRawHTMLButton" data-iframe-id="${this.iframeId()}">Copy iframe HTML</button>
<button class="action good maximizeButton" data-container-id="${this.containerId()}">Max/min</button>
<button class="action good pinLeftButton" data-container-id="${this.containerId()}">←</button>
<button class="action good pinRightButton" data-container-id="${this.containerId()}">→</button>
<button class="action good overlayButton" data-container-id="${this.containerId()}">Overlay</button>
<button class="action good fullscreenButton" data-container-id="${this.containerId()}">Fullscreen</button>
<button class="action copyRichTextButton" data-iframe-id="${this.iframeId()}">Copy rich text</button>
<button class="action viewCodeDiffButton" data-iframe-id="${this.iframeId()}">View code diff (Prettier)</button>
<button class="action processThisButton" data-iframe-id="${this.iframeId()}">Process this</button>
</div>
<iframe class="viewer" id="${this.iframeId()}"></iframe>
</div>`;

  renderSanitizerChainDescription = () => {
    return this.sanitizerNameList
      .map((sName) => TJSanitizers.description(sName))
      .join(" → ");
  };
  renderFrameDescription = () => {
    return TJFrames.description(this.frameName);
  };
}

var TJPreviewers = [];

function initialize() {
  var previewArea = document.getElementById("previewers");
  previewArea.innerHTML = "";
  previewers.forEach((p) => {
    console.log(`Creating previewer ${p.name}`);
    var previewer = new Previewer(p);
    previewArea.innerHTML += previewer.renderOutputIframe();
    TJPreviewers.push(new Previewer(p));
  });

  initializeButtonActions();
  updatePreviewers();
}

function updatePreviewers() {
  console.log(`Updating previewers...`);

  TJPreviewers.forEach((p) => {
    console.log(`* ${p.name}`);
    p.updatePreviewer();
  });

  console.log(`Initializing sync scroll across previewers...`);
  initializeSyncScroll();
}

initialize();

function viewCodeDiff(oldCode, newCode) {
  class Diff extends PureComponent {
    highlightSyntax = (str) => (
      <pre
        style={{ display: "inline" }}
        dangerouslySetInnerHTML={{
          __html: Prism.highlight(str, Prism.languages.html, "html")
        }}
      />
    );

    render = () => {
      return (
        <ReactDiffViewer
          oldValue={oldCode}
          newValue={newCode}
          splitView={true}
          compareMethod="diffWordsWithSpace"
          // renderContent={this.highlightSyntax}
        />
      );
    };
  }

  var diffId = `${Math.floor(Math.random() * 10000 + 1)}`;
  var diffViewerContainer = `
  <div class="previewer diffViewer maximize" id="diffContainer-${diffId}">
<div class="controls">
<span class="description sanitizerChain">Code diff</span>
<span class="description frame">Yes</span>
<button class="action good maximizeButton" data-container-id="diffContainer-${diffId}">Max/min</button>
<button class="action good fullscreenButton" data-container-id="diffContainer-${diffId}">Fullscreen</button>
</div>
<div class="viewer overflow" id="diffViewer-${diffId}"></div>
</div>
  `;

  var previewArea = document.querySelector("#previewers");
  previewArea.insertAdjacentHTML("beforeend", diffViewerContainer);

  ReactDOM.render(<Diff />, document.getElementById(`diffViewer-${diffId}`));
}

document.querySelector("#inputRawHTML").addEventListener("input", (event) => {
  console.log("Raw HTML changed");
  document.querySelector("#inputPasteHTML").innerHTML = event.target.value;
  updatePreviewers();
});

document.querySelector("#inputPasteHTML").addEventListener("input", (event) => {
  console.log("Paste HTML changed");
  document.querySelector("#inputRawHTML").value = event.target.innerHTML;
  updatePreviewers();
});

const inputRawHTML = document.querySelector("#inputRawHTML");
const inputPasteHTML = document.querySelector("#inputPasteHTML");

function initializeButtonActions() {
  document
    .querySelector("#addExampleButton")
    .addEventListener("click", (event) => {
      console.log(`Adding Word example`);
      addExample();
    });

  document
    .querySelector("#addFlightsExampleButton")
    .addEventListener("click", (event) => {
      console.log(`Adding Flights example`);
      addFlightsExample();
    });

  document.querySelector("#clearButton").addEventListener("click", (event) => {
    console.log(`Clearing`);
    clear();
  });

  document.querySelector("#initButton").addEventListener("click", (event) => {
    console.log(`Init`);
    initialize();
  });

  document.querySelectorAll(".copyRawHTMLButton").forEach((el) =>
    el.addEventListener("click", (event) => {
      console.log(`Copy initiated on ${event.target.dataset.iframeId}`);
      copyToClipboard(event.target.dataset.iframeId, false);
    })
  );

  document.querySelectorAll(".copyRichTextButton").forEach((el) =>
    el.addEventListener("click", (event) => {
      console.log(
        `Rich text copy initiated on ${event.target.dataset.iframeId}`
      );
      copyToClipboard(event.target.dataset.iframeId, true);
    })
  );

  document.querySelectorAll(".viewCodeDiffButton").forEach((el) =>
    el.addEventListener("click", (event) => {
      console.log(
        `View code diff initiated on ${event.target.dataset.iframeId}`
      );

      var origHTML = inputRawHTML.value;
      var newHTML = document.getElementById(event.target.dataset.iframeId)
        .contentWindow.document.body.innerHTML;

      viewCodeDiff(getPrettierHTML(origHTML), getPrettierHTML(newHTML));
    })
  );

  var cssButtonToggles = [
    "maximize",
    "pinLeft",
    "pinRight",
    "overlay",
    "fullscreen"
  ];

  cssButtonToggles.forEach((type) => {
    console.log(`Initializing button ${type}`);
    document.querySelectorAll(`.${type}Button`).forEach((el) =>
      el.addEventListener("click", (event) => {
        console.log(`${type} initiated on ${event.target.dataset.containerId}`);
        toggle(event.target.dataset.containerId, type);
      })
    );
  });
}

function initializeSyncScroll() {
  var sourceIframeId = TJPreviewers[0].iframeId();
  var sourceIframe = document.getElementById(sourceIframeId);

  console.log(`Scroll event handler on #${sourceIframeId}`);

  sourceIframe.contentWindow.addEventListener("scroll", (event) => {
    var x = sourceIframe.contentWindow.scrollX;
    var y = sourceIframe.contentWindow.scrollY;
    // console.log(`Scroll event (${x},${y})`);
    allScrollTo(sourceIframeId, x, y);
  });
}

function allScrollTo(sourceIframeId, top, left) {
  TJPreviewers.forEach((p) => {
    if (p.iframeId() === sourceIframeId) {
      return;
    }
    var destIframe = document.getElementById(p.iframeId());
    // console.log(`Scrolling iframe ${plugin.iframeId()} to (${top},${left})`);
    destIframe.contentWindow.scrollTo(top, left);
  });
}

function toggle(containerId, className) {
  var container = document.getElementById(containerId);
  if (container.classList.contains(className)) {
    container.classList.remove(className);
  } else {
    container.classList.add(className);
  }
}

function copyToClipboard(iframeId, copyAsRichText) {
  var iframe = document.getElementById(iframeId);

  let content = iframe.contentWindow.document.body.innerHTML;

  // let mimeType = copyAsRichText ? "text/html" : "text/plain";

  // let data = [new ClipboardItem({ [mimeType]: content })];

  navigator.clipboard.writeText(content).then(
    function () {
      console.log("Copy to clipboard success");
    },
    function () {
      console.log("Copy to clipboard FAILED");
    }
  );

  // console.log(content);

  // let text = new Blob([content], {type: 'text/plain'});
  // let item = new ClipboardItem({
  //   'text/plain': text
  // });

  // console.log(item);

  // navigator.clipboard.write([item]).then(
  //   function () {
  //     console.log("Copy to clipboard success");
  //   },
  //   function () {
  //     console.log("Copy to clipboard FAILED");
  //   }
  // );
}

function getPrettierHTML(code) {
  return prettier.format(code, {
    parser: "html",
    plugins: [prettierHTML]
  });
}

function clear() {
  inputRawHTML.value = "";
  inputPasteHTML.innerHTML = "";
  updatePreviewers();
}

function addExample() {
  const wordExample = `<html xmlns:o="urn:schemas-microsoft-com:office:office"
xmlns:w="urn:schemas-microsoft-com:office:word"
xmlns:m="http://schemas.microsoft.com/office/2004/12/omml"
xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta name=Title content="">
<meta name=Keywords content="">
<meta http-equiv=Content-Type content="text/html; charset=utf-8">
<meta name=ProgId content=Word.Document>
<meta name=Generator content="Microsoft Word 14">
<meta name=Originator content="Microsoft Word 14">
<link rel=File-List
href="file://localhost/private/var/folders/ly/bl_p2tms4qz943_tpxfh2wxw0000gn/T/TemporaryItems/msoclip/0/clip_filelist.xml">
<!--[if gte mso 9]><xml>
 <o:OfficeDocumentSettings>
  <o:RelyOnVML/>
  <o:AllowPNG/>
 </o:OfficeDocumentSettings>
</xml><![endif]-->
<link rel=themeData
href="file://localhost/private/var/folders/ly/bl_p2tms4qz943_tpxfh2wxw0000gn/T/TemporaryItems/msoclip/0/clip_themedata.xml">
<!--[if gte mso 9]><xml>
 <w:WordDocument>
  <w:View>Normal</w:View>
  <w:Zoom>0</w:Zoom>
  <w:TrackMoves/>
  <w:TrackFormatting/>
  <w:PunctuationKerning/>
  <w:ValidateAgainstSchemas/>
  <w:SaveIfXMLInvalid>false</w:SaveIfXMLInvalid>
  <w:IgnoreMixedContent>false</w:IgnoreMixedContent>
  <w:AlwaysShowPlaceholderText>false</w:AlwaysShowPlaceholderText>
  <w:DoNotPromoteQF/>
  <w:LidThemeOther>EN-US</w:LidThemeOther>
  <w:LidThemeAsian>JA</w:LidThemeAsian>
  <w:LidThemeComplexScript>X-NONE</w:LidThemeComplexScript>
  <w:Compatibility>
   <w:BreakWrappedTables/>
   <w:SnapToGridInCell/>
   <w:WrapTextWithPunct/>
   <w:UseAsianBreakRules/>
   <w:DontGrowAutofit/>
   <w:SplitPgBreakAndParaMark/>
   <w:EnableOpenTypeKerning/>
   <w:DontFlipMirrorIndents/>
   <w:OverrideTableStyleHps/>
  </w:Compatibility>
  <m:mathPr>
   <m:mathFont m:val="Cambria Math"/>
   <m:brkBin m:val="before"/>
   <m:brkBinSub m:val="&#45;-"/>
   <m:smallFrac m:val="off"/>
   <m:dispDef/>
   <m:lMargin m:val="0"/>
   <m:rMargin m:val="0"/>
   <m:defJc m:val="centerGroup"/>
   <m:wrapIndent m:val="1440"/>
   <m:intLim m:val="subSup"/>
   <m:naryLim m:val="undOvr"/>
  </m:mathPr></w:WordDocument>
</xml><![endif]--><!--[if gte mso 9]><xml>
 <w:LatentStyles DefLockedState="false" DefUnhideWhenUsed="true"
  DefSemiHidden="true" DefQFormat="false" DefPriority="99"
  LatentStyleCount="276">
  <w:LsdException Locked="false" Priority="0" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Normal"/>
  <w:LsdException Locked="false" Priority="9" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="heading 1"/>
  <w:LsdException Locked="false" Priority="9" QFormat="true" Name="heading 2"/>
  <w:LsdException Locked="false" Priority="9" QFormat="true" Name="heading 3"/>
  <w:LsdException Locked="false" Priority="9" QFormat="true" Name="heading 4"/>
  <w:LsdException Locked="false" Priority="9" QFormat="true" Name="heading 5"/>
  <w:LsdException Locked="false" Priority="9" QFormat="true" Name="heading 6"/>
  <w:LsdException Locked="false" Priority="9" QFormat="true" Name="heading 7"/>
  <w:LsdException Locked="false" Priority="9" QFormat="true" Name="heading 8"/>
  <w:LsdException Locked="false" Priority="9" QFormat="true" Name="heading 9"/>
  <w:LsdException Locked="false" Priority="39" Name="toc 1"/>
  <w:LsdException Locked="false" Priority="39" Name="toc 2"/>
  <w:LsdException Locked="false" Priority="39" Name="toc 3"/>
  <w:LsdException Locked="false" Priority="39" Name="toc 4"/>
  <w:LsdException Locked="false" Priority="39" Name="toc 5"/>
  <w:LsdException Locked="false" Priority="39" Name="toc 6"/>
  <w:LsdException Locked="false" Priority="39" Name="toc 7"/>
  <w:LsdException Locked="false" Priority="39" Name="toc 8"/>
  <w:LsdException Locked="false" Priority="39" Name="toc 9"/>
  <w:LsdException Locked="false" Priority="35" QFormat="true" Name="caption"/>
  <w:LsdException Locked="false" Priority="10" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Title"/>
  <w:LsdException Locked="false" Priority="1" Name="Default Paragraph Font"/>
  <w:LsdException Locked="false" Priority="11" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Subtitle"/>
  <w:LsdException Locked="false" Priority="22" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Strong"/>
  <w:LsdException Locked="false" Priority="20" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Emphasis"/>
  <w:LsdException Locked="false" Priority="0" Name="Plain Text"/>
  <w:LsdException Locked="false" Priority="59" SemiHidden="false"
   UnhideWhenUsed="false" Name="Table Grid"/>
  <w:LsdException Locked="false" UnhideWhenUsed="false" Name="Placeholder Text"/>
  <w:LsdException Locked="false" Priority="1" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="No Spacing"/>
  <w:LsdException Locked="false" Priority="60" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Shading"/>
  <w:LsdException Locked="false" Priority="61" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light List"/>
  <w:LsdException Locked="false" Priority="62" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Grid"/>
  <w:LsdException Locked="false" Priority="63" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 1"/>
  <w:LsdException Locked="false" Priority="64" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 2"/>
  <w:LsdException Locked="false" Priority="65" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 1"/>
  <w:LsdException Locked="false" Priority="66" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 2"/>
  <w:LsdException Locked="false" Priority="67" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 1"/>
  <w:LsdException Locked="false" Priority="68" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 2"/>
  <w:LsdException Locked="false" Priority="69" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 3"/>
  <w:LsdException Locked="false" Priority="70" SemiHidden="false"
   UnhideWhenUsed="false" Name="Dark List"/>
  <w:LsdException Locked="false" Priority="71" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Shading"/>
  <w:LsdException Locked="false" Priority="72" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful List"/>
  <w:LsdException Locked="false" Priority="73" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Grid"/>
  <w:LsdException Locked="false" Priority="60" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Shading Accent 1"/>
  <w:LsdException Locked="false" Priority="61" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light List Accent 1"/>
  <w:LsdException Locked="false" Priority="62" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Grid Accent 1"/>
  <w:LsdException Locked="false" Priority="63" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 1 Accent 1"/>
  <w:LsdException Locked="false" Priority="64" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 2 Accent 1"/>
  <w:LsdException Locked="false" Priority="65" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 1 Accent 1"/>
  <w:LsdException Locked="false" UnhideWhenUsed="false" Name="Revision"/>
  <w:LsdException Locked="false" Priority="34" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="List Paragraph"/>
  <w:LsdException Locked="false" Priority="29" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Quote"/>
  <w:LsdException Locked="false" Priority="30" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Intense Quote"/>
  <w:LsdException Locked="false" Priority="66" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 2 Accent 1"/>
  <w:LsdException Locked="false" Priority="67" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 1 Accent 1"/>
  <w:LsdException Locked="false" Priority="68" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 2 Accent 1"/>
  <w:LsdException Locked="false" Priority="69" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 3 Accent 1"/>
  <w:LsdException Locked="false" Priority="70" SemiHidden="false"
   UnhideWhenUsed="false" Name="Dark List Accent 1"/>
  <w:LsdException Locked="false" Priority="71" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Shading Accent 1"/>
  <w:LsdException Locked="false" Priority="72" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful List Accent 1"/>
  <w:LsdException Locked="false" Priority="73" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Grid Accent 1"/>
  <w:LsdException Locked="false" Priority="60" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Shading Accent 2"/>
  <w:LsdException Locked="false" Priority="61" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light List Accent 2"/>
  <w:LsdException Locked="false" Priority="62" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Grid Accent 2"/>
  <w:LsdException Locked="false" Priority="63" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 1 Accent 2"/>
  <w:LsdException Locked="false" Priority="64" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 2 Accent 2"/>
  <w:LsdException Locked="false" Priority="65" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 1 Accent 2"/>
  <w:LsdException Locked="false" Priority="66" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 2 Accent 2"/>
  <w:LsdException Locked="false" Priority="67" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 1 Accent 2"/>
  <w:LsdException Locked="false" Priority="68" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 2 Accent 2"/>
  <w:LsdException Locked="false" Priority="69" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 3 Accent 2"/>
  <w:LsdException Locked="false" Priority="70" SemiHidden="false"
   UnhideWhenUsed="false" Name="Dark List Accent 2"/>
  <w:LsdException Locked="false" Priority="71" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Shading Accent 2"/>
  <w:LsdException Locked="false" Priority="72" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful List Accent 2"/>
  <w:LsdException Locked="false" Priority="73" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Grid Accent 2"/>
  <w:LsdException Locked="false" Priority="60" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Shading Accent 3"/>
  <w:LsdException Locked="false" Priority="61" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light List Accent 3"/>
  <w:LsdException Locked="false" Priority="62" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Grid Accent 3"/>
  <w:LsdException Locked="false" Priority="63" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 1 Accent 3"/>
  <w:LsdException Locked="false" Priority="64" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 2 Accent 3"/>
  <w:LsdException Locked="false" Priority="65" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 1 Accent 3"/>
  <w:LsdException Locked="false" Priority="66" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 2 Accent 3"/>
  <w:LsdException Locked="false" Priority="67" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 1 Accent 3"/>
  <w:LsdException Locked="false" Priority="68" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 2 Accent 3"/>
  <w:LsdException Locked="false" Priority="69" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 3 Accent 3"/>
  <w:LsdException Locked="false" Priority="70" SemiHidden="false"
   UnhideWhenUsed="false" Name="Dark List Accent 3"/>
  <w:LsdException Locked="false" Priority="71" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Shading Accent 3"/>
  <w:LsdException Locked="false" Priority="72" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful List Accent 3"/>
  <w:LsdException Locked="false" Priority="73" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Grid Accent 3"/>
  <w:LsdException Locked="false" Priority="60" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Shading Accent 4"/>
  <w:LsdException Locked="false" Priority="61" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light List Accent 4"/>
  <w:LsdException Locked="false" Priority="62" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Grid Accent 4"/>
  <w:LsdException Locked="false" Priority="63" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 1 Accent 4"/>
  <w:LsdException Locked="false" Priority="64" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 2 Accent 4"/>
  <w:LsdException Locked="false" Priority="65" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 1 Accent 4"/>
  <w:LsdException Locked="false" Priority="66" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 2 Accent 4"/>
  <w:LsdException Locked="false" Priority="67" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 1 Accent 4"/>
  <w:LsdException Locked="false" Priority="68" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 2 Accent 4"/>
  <w:LsdException Locked="false" Priority="69" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 3 Accent 4"/>
  <w:LsdException Locked="false" Priority="70" SemiHidden="false"
   UnhideWhenUsed="false" Name="Dark List Accent 4"/>
  <w:LsdException Locked="false" Priority="71" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Shading Accent 4"/>
  <w:LsdException Locked="false" Priority="72" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful List Accent 4"/>
  <w:LsdException Locked="false" Priority="73" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Grid Accent 4"/>
  <w:LsdException Locked="false" Priority="60" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Shading Accent 5"/>
  <w:LsdException Locked="false" Priority="61" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light List Accent 5"/>
  <w:LsdException Locked="false" Priority="62" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Grid Accent 5"/>
  <w:LsdException Locked="false" Priority="63" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 1 Accent 5"/>
  <w:LsdException Locked="false" Priority="64" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 2 Accent 5"/>
  <w:LsdException Locked="false" Priority="65" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 1 Accent 5"/>
  <w:LsdException Locked="false" Priority="66" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 2 Accent 5"/>
  <w:LsdException Locked="false" Priority="67" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 1 Accent 5"/>
  <w:LsdException Locked="false" Priority="68" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 2 Accent 5"/>
  <w:LsdException Locked="false" Priority="69" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 3 Accent 5"/>
  <w:LsdException Locked="false" Priority="70" SemiHidden="false"
   UnhideWhenUsed="false" Name="Dark List Accent 5"/>
  <w:LsdException Locked="false" Priority="71" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Shading Accent 5"/>
  <w:LsdException Locked="false" Priority="72" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful List Accent 5"/>
  <w:LsdException Locked="false" Priority="73" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Grid Accent 5"/>
  <w:LsdException Locked="false" Priority="60" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Shading Accent 6"/>
  <w:LsdException Locked="false" Priority="61" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light List Accent 6"/>
  <w:LsdException Locked="false" Priority="62" SemiHidden="false"
   UnhideWhenUsed="false" Name="Light Grid Accent 6"/>
  <w:LsdException Locked="false" Priority="63" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 1 Accent 6"/>
  <w:LsdException Locked="false" Priority="64" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Shading 2 Accent 6"/>
  <w:LsdException Locked="false" Priority="65" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 1 Accent 6"/>
  <w:LsdException Locked="false" Priority="66" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium List 2 Accent 6"/>
  <w:LsdException Locked="false" Priority="67" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 1 Accent 6"/>
  <w:LsdException Locked="false" Priority="68" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 2 Accent 6"/>
  <w:LsdException Locked="false" Priority="69" SemiHidden="false"
   UnhideWhenUsed="false" Name="Medium Grid 3 Accent 6"/>
  <w:LsdException Locked="false" Priority="70" SemiHidden="false"
   UnhideWhenUsed="false" Name="Dark List Accent 6"/>
  <w:LsdException Locked="false" Priority="71" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Shading Accent 6"/>
  <w:LsdException Locked="false" Priority="72" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful List Accent 6"/>
  <w:LsdException Locked="false" Priority="73" SemiHidden="false"
   UnhideWhenUsed="false" Name="Colorful Grid Accent 6"/>
  <w:LsdException Locked="false" Priority="19" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Subtle Emphasis"/>
  <w:LsdException Locked="false" Priority="21" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Intense Emphasis"/>
  <w:LsdException Locked="false" Priority="31" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Subtle Reference"/>
  <w:LsdException Locked="false" Priority="32" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Intense Reference"/>
  <w:LsdException Locked="false" Priority="33" SemiHidden="false"
   UnhideWhenUsed="false" QFormat="true" Name="Book Title"/>
  <w:LsdException Locked="false" Priority="37" Name="Bibliography"/>
  <w:LsdException Locked="false" Priority="39" QFormat="true" Name="TOC Heading"/>
 </w:LatentStyles>
</xml><![endif]-->
<style>
<!--
 /* Font Definitions */
@font-face
	{font-family:Arial;
	panose-1:2 11 6 4 2 2 2 2 2 4;
	mso-font-charset:0;
	mso-generic-font-family:auto;
	mso-font-pitch:variable;
	mso-font-signature:-536859905 -1073711037 9 0 511 0;}
@font-face
	{font-family:"Courier New";
	panose-1:2 7 3 9 2 2 5 2 4 4;
	mso-font-charset:0;
	mso-generic-font-family:auto;
	mso-font-pitch:variable;
	mso-font-signature:-536859905 -1073711037 9 0 511 0;}
@font-face
	{font-family:"Cambria Math";
	panose-1:2 4 5 3 5 4 6 3 2 4;
	mso-font-charset:0;
	mso-generic-font-family:auto;
	mso-font-pitch:variable;
	mso-font-signature:-536870145 1107305727 0 0 415 0;}
@font-face
	{font-family:Calibri;
	panose-1:2 15 5 2 2 2 4 3 2 4;
	mso-font-charset:0;
	mso-generic-font-family:auto;
	mso-font-pitch:variable;
	mso-font-signature:-520092929 1073786111 9 0 415 0;}
 /* Style Definitions */
p.MsoNormal, li.MsoNormal, div.MsoNormal
	{mso-style-unhide:no;
	mso-style-qformat:yes;
	mso-style-parent:"";
	margin:0in;
	margin-bottom:.0001pt;
	mso-pagination:widow-orphan;
	font-size:12.0pt;
	font-family:"Times New Roman";
	mso-fareast-font-family:"Times New Roman";
	color:windowtext;}
p.MsoPlainText, li.MsoPlainText, div.MsoPlainText
	{mso-style-unhide:no;
	mso-style-link:"Plain Text Char";
	margin:0in;
	margin-bottom:.0001pt;
	mso-pagination:widow-orphan;
	font-size:10.0pt;
	font-family:"Courier New";
	mso-fareast-font-family:"Times New Roman";
	color:windowtext;}
p
	{mso-style-priority:99;
	mso-style-unhide:no;
	mso-margin-top-alt:auto;
	margin-right:0in;
	mso-margin-bottom-alt:auto;
	margin-left:0in;
	mso-pagination:widow-orphan;
	font-size:12.0pt;
	font-family:Arial;
	mso-fareast-font-family:"Times New Roman";
	color:#B40000;}
span.PlainTextChar
	{mso-style-name:"Plain Text Char";
	mso-style-unhide:no;
	mso-style-locked:yes;
	mso-style-link:"Plain Text";
	mso-ansi-font-size:10.0pt;
	mso-bidi-font-size:10.0pt;
	font-family:"Courier New";
	mso-ascii-font-family:"Courier New";
	mso-fareast-font-family:"Times New Roman";
	mso-hansi-font-family:"Courier New";
	mso-bidi-font-family:"Courier New";}
span.style21
	{mso-style-name:style21;
	mso-style-unhide:no;
	color:#7F3F00;}
.MsoChpDefault
	{mso-style-type:export-only;
	mso-default-props:yes;
	font-size:11.0pt;
	mso-ansi-font-size:11.0pt;
	mso-bidi-font-size:11.0pt;
	font-family:Calibri;
	mso-ascii-font-family:Calibri;
	mso-ascii-theme-font:minor-latin;
	mso-fareast-font-family:Calibri;
	mso-fareast-theme-font:minor-latin;
	mso-hansi-font-family:Calibri;
	mso-hansi-theme-font:minor-latin;
	mso-bidi-font-family:"Times New Roman";
	mso-bidi-theme-font:minor-bidi;}
.MsoPapDefault
	{mso-style-type:export-only;
	margin-bottom:10.0pt;
	line-height:115%;}
@page WordSection1
	{size:8.5in 11.0in;
	margin:1.0in 1.25in 1.0in 1.25in;
	mso-header-margin:.5in;
	mso-footer-margin:.5in;
	mso-paper-source:0;}
div.WordSection1
	{page:WordSection1;}
 /* List Definitions */
@list l0
	{mso-list-id:1950352137;
	mso-list-type:hybrid;
	mso-list-template-ids:-466959970 1029309760 67698713 67698715 67698703 67698713 67698715 67698703 67698713 67698715;}
@list l0:level1
	{mso-level-tab-stop:none;
	mso-level-number-position:left;
	margin-left:40.5pt;
	text-indent:-.25in;
	mso-fareast-font-family:"Times New Roman";
	color:windowtext;}
@list l0:level2
	{mso-level-number-format:alpha-lower;
	mso-level-tab-stop:none;
	mso-level-number-position:left;
	margin-left:76.5pt;
	text-indent:-.25in;}
@list l0:level3
	{mso-level-number-format:roman-lower;
	mso-level-tab-stop:none;
	mso-level-number-position:right;
	margin-left:112.5pt;
	text-indent:-9.0pt;}
@list l0:level4
	{mso-level-tab-stop:none;
	mso-level-number-position:left;
	margin-left:148.5pt;
	text-indent:-.25in;}
@list l0:level5
	{mso-level-number-format:alpha-lower;
	mso-level-tab-stop:none;
	mso-level-number-position:left;
	margin-left:184.5pt;
	text-indent:-.25in;}
@list l0:level6
	{mso-level-number-format:roman-lower;
	mso-level-tab-stop:none;
	mso-level-number-position:right;
	margin-left:220.5pt;
	text-indent:-9.0pt;}
@list l0:level7
	{mso-level-tab-stop:none;
	mso-level-number-position:left;
	margin-left:256.5pt;
	text-indent:-.25in;}
@list l0:level8
	{mso-level-number-format:alpha-lower;
	mso-level-tab-stop:none;
	mso-level-number-position:left;
	margin-left:292.5pt;
	text-indent:-.25in;}
@list l0:level9
	{mso-level-number-format:roman-lower;
	mso-level-tab-stop:none;
	mso-level-number-position:right;
	margin-left:328.5pt;
	text-indent:-9.0pt;}
ol
	{margin-bottom:0in;}
ul
	{margin-bottom:0in;}
-->
</style>
<!--[if gte mso 10]>
<style>
 /* Style Definitions */
table.MsoNormalTable
	{mso-style-name:"Table Normal";
	mso-tstyle-rowband-size:0;
	mso-tstyle-colband-size:0;
	mso-style-noshow:yes;
	mso-style-priority:99;
	mso-style-parent:"";
	mso-padding-alt:0in 5.4pt 0in 5.4pt;
	mso-para-margin-top:0in;
	mso-para-margin-right:0in;
	mso-para-margin-bottom:10.0pt;
	mso-para-margin-left:0in;
	line-height:115%;
	mso-pagination:widow-orphan;
	font-size:11.0pt;
	font-family:Calibri;
	mso-ascii-font-family:Calibri;
	mso-ascii-theme-font:minor-latin;
	mso-hansi-font-family:Calibri;
	mso-hansi-theme-font:minor-latin;}
</style>
<![endif]-->
</head>
<body bgcolor=white lang=EN-US style='tab-interval:.5in'>
<!--StartFragment-->
<p style='margin:0in;margin-bottom:.0001pt;tab-stops:.5in 1.0in 1.5in 128.25pt 2.0in 279.0pt 333.0pt'><span
class=style21><u><span style='color:windowtext;mso-bidi-font-weight:bold'>Lecture</span></u></span><span
class=style21><span style='color:windowtext;mso-bidi-font-weight:bold'>: TR 12:30
-1:45pm; Room 22 ten Hoor<o:p></o:p></span></span></p>
<p style='margin:0in;margin-bottom:.0001pt;tab-stops:333.0pt'><span
class=style21><b><span style='color:windowtext'><o:p>&nbsp;</o:p></span></b></span></p>
<p style='margin:0in;margin-bottom:.0001pt;tab-stops:333.0pt'><span
class=style21><b><span style='color:windowtext'>Course Description:</span></b></span><span
style='color:windowtext;mso-bidi-font-weight:bold'> </span><span
style='mso-fareast-font-family:Calibri;mso-fareast-theme-font:minor-latin;
color:windowtext'>This class will provide an overview of the prehistory,
history, and modern day cultural diversity of Native Americans throughout North
America.<span style="mso-spacerun:yes">  </span>Social, economic, and technological
developments of different native groups are explored including changes as a
result of European contact and recent attempts to revitalize Native American
culture. </span><span style='color:windowtext'><span
style="mso-spacerun:yes"> </span>In this course, </span><span style='mso-fareast-font-family:
Calibri;mso-fareast-theme-font:minor-latin;color:windowtext'>the traditional
and contemporary lifeways of North American Indian tribes from eleven different
culture areas are presented.<span style="mso-spacerun:yes">  </span>Students will
develop critical thinking skills by analyzing and evaluating the geographical,
economic, and cultural adaptations of each region.<o:p></o:p></span></p>
<p class=MsoNormal style='mso-layout-grid-align:none;text-autospace:none'><span
style='font-family:Arial;mso-fareast-font-family:Calibri;mso-fareast-theme-font:
minor-latin;color:black'><o:p>&nbsp;</o:p></span></p>
<p class=MsoPlainText style='tab-stops:333.0pt'><b><span style='font-size:12.0pt;
font-family:Arial'>Course Prerequisites/Corequisites:</span></b><span
style='font-size:12.0pt;font-family:Arial;mso-bidi-font-weight:bold'> None<o:p></o:p></span></p>
<p class=MsoPlainText><span style='font-size:12.0pt;font-family:Arial;
mso-bidi-font-weight:bold'><o:p>&nbsp;</o:p></span></p>
<p class=MsoPlainText><b><span style='font-size:12.0pt;font-family:Arial'>Learning
Outcomes:</span></b><span style='font-size:12.0pt;font-family:Arial;mso-bidi-font-weight:
bold'> Upon the completion of this course, students should be able to:<o:p></o:p></span></p>
<p class=MsoPlainText style='margin-top:0in;margin-right:-13.5pt;margin-bottom:
0in;margin-left:40.5pt;margin-bottom:.0001pt;text-indent:-.25in;mso-list:l0 level1 lfo1'><![if !supportLists]><span
style='font-size:12.0pt;font-family:Arial;mso-fareast-font-family:Arial'><span
style='mso-list:Ignore'>1.<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;
</span></span></span><![endif]><span style='font-size:12.0pt;font-family:Arial;
mso-bidi-font-weight:bold'>Explain the trajectory of </span><span
style='font-size:12.0pt;font-family:Arial;mso-fareast-font-family:Calibri;
mso-fareast-theme-font:minor-latin;color:black'>technological and cultural
developments of prehistoric Native Americas prior to European contact<o:p></o:p></span></p>
<p class=MsoPlainText style='margin-top:0in;margin-right:-13.5pt;margin-bottom:
0in;margin-left:40.5pt;margin-bottom:.0001pt;text-indent:-.25in;mso-list:l0 level1 lfo1'><![if !supportLists]><span
style='font-size:12.0pt;font-family:Arial;mso-fareast-font-family:Arial'><span
style='mso-list:Ignore'>2.<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;
</span></span></span><![endif]><span style='font-size:12.0pt;font-family:Arial;
mso-fareast-font-family:Calibri;mso-fareast-theme-font:minor-latin;color:black'>Describe
changes in Native American technology and social organization as a result of
European contact<o:p></o:p></span></p>
<p class=MsoPlainText style='margin-top:0in;margin-right:-13.5pt;margin-bottom:
0in;margin-left:40.5pt;margin-bottom:.0001pt;text-indent:-.25in;mso-list:l0 level1 lfo1'><![if !supportLists]><span
style='font-size:12.0pt;font-family:Arial;mso-fareast-font-family:Arial'><span
style='mso-list:Ignore'>3.<span style='font:7.0pt "Times New Roman"'>&nbsp;&nbsp;&nbsp;
</span></span></span><![endif]><span style='font-size:12.0pt;font-family:Arial;
mso-fareast-font-family:Calibri;mso-fareast-theme-font:minor-latin;color:black'>Recall
the names, locations, and geography of the 11 Native America culture areas of
North America<o:p></o:p></span></p>
<p class=MsoNormal style='margin-left:40.5pt;text-indent:-.25in'><span
style='font-family:Arial;mso-bidi-font-weight:bold'>4. <span
style="mso-spacerun:yes"> </span>Define the different Native America culture
areas and describe differences between the Native Americans of these areas in
terms of their environment, technology, and social organization<o:p></o:p></span></p>
<!--EndFragment-->
</body>
</html>
`;

  inputRawHTML.value = wordExample;
  inputPasteHTML.innerHTML = wordExample;
  updatePreviewers();
}

function addFlightsExample() {
  const flightsExample = `<div jsname="djPc0e" style="-webkit-tap-highlight-color: transparent; color: rgb(95, 99, 104); font-family: Roboto, Arial, sans-serif; font-size: 14px; letter-spacing: 0.2px;"><div class="i01GId taHBqe" style="-webkit-tap-highlight-color: transparent; margin-top: 16px; transition: opacity 300ms cubic-bezier(0.4, 0, 0.2, 1) 0s;"><div class="llH13c BgYkof" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 20px; line-height: 24px; font-family: &quot;Google Sans&quot;, Roboto, Arial, sans-serif; letter-spacing: normal; color: rgb(32, 33, 36); align-items: center; margin: 16px 0px 12px;"><h3 class="ql3MOd" jsname="Ud7fr" tabindex="-1" style="-webkit-tap-highlight-color: transparent; font-size: 1em; font-weight: normal; margin: 0px; padding: 0px; display: inline; outline: none;">Best departing flights</h3><span title="Why these options?" class="pPxTb" style="-webkit-tap-highlight-color: transparent; line-height: 1em; vertical-align: middle; padding-left: 6px;"><g-bubble jscontroller="BlFnV" data-ci="" data-to="70" data-tp="4" jsshadow="" style="-webkit-tap-highlight-color: transparent;"><span jsname="d6wfac" class="CrAOse-hSRGPd " data-extra-container-classes="EQDr2d gQSlLe V4aGXc Z70YUb" data-extra-triangle-classes="aTf4cb eN65Ce Txwrvb" data-hover-hide-delay="1000" data-hover-open-delay="500" data-theme="0" data-width="400" role="button" tabindex="0" jsaction="vQLyHf" jsslot="" style="-webkit-tap-highlight-color: transparent; cursor: pointer;"><span class="zlyfOd" aria-label="Learn more about ranking" style="-webkit-tap-highlight-color: transparent; position: relative;"><svg width="18" height="18" viewBox="0 0 24 24" focusable="false" class="vmWDCc NMm5M"><path d="M11 17h2v-6h-2v6zm1-15C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zM11 9h2V7h-2v2z"></path></svg></span></span></g-bubble></span></div><div class="KQkJf sSHqwe" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 12px; line-height: 16px; letter-spacing: 0.3px; margin: -18px 0px 6px;"><div class="tEXind" style="-webkit-tap-highlight-color: transparent; display: flex; align-items: baseline;"><div class="CwAhtb EA71Tc" style="-webkit-tap-highlight-color: transparent;">Total price includes taxes + fees for 1 adult.&nbsp;<span jscontroller="mmgUvd" style="-webkit-tap-highlight-color: transparent;"><a tabindex="0" role="button" jsaction="hiScPe" class="yal7Wd fjg0te" style="-webkit-tap-highlight-color: transparent; text-decoration-line: underline; color: inherit; cursor: pointer;">Additional bag fees</a>&nbsp;and other fees may apply.</span></div><div class="MJUb4e" style="-webkit-tap-highlight-color: transparent; margin-left: auto;"><div jscontroller="U5T3Ef" jsaction="zTTgw:pjtQI;wht6Cc:uwbb2e" style="-webkit-tap-highlight-color: transparent;"><div jscontroller="nbcXFc" jsname="KNtIcd" jsaction="V4EYZb:QqgoLb;fUXaYe:PYx8lc" class="KJonad mX9Jt aB459b" data-value="1" style="-webkit-tap-highlight-color: transparent; display: inline-block;"><div jscontroller="qrQlLd" jsname="j4gsHd" class="v0tSxb SOcuWe" data-config="5 13 12 0 6" jsshadow="" style="-webkit-tap-highlight-color: transparent; display: inline-block; position: relative;"><div class="dvO2xc k0gFV" jsaction="JIbuQc:ornU0b; keydown:ecIpnc" jsname="kj0dLd" jsslot="" style="-webkit-tap-highlight-color: transparent; margin: -6px 0px;"><div jsaction="JIbuQc:SGG6of" style="-webkit-tap-highlight-color: transparent;"><button class="VfPpkd-LgbsSe VfPpkd-LgbsSe-OWXEXe-dgl2Hf ksBjEc lKxP2d zZJEBe" jscontroller="soHxf" jsaction="click:cOuCgd; mousedown:UX7yZ; mouseup:lbsD7e; mouseenter:tfO1Yc; mouseleave:JywGue; touchstart:p6p2H; touchmove:FwuNnf; touchend:yfqBxc; touchcancel:JMtRjd; focus:AHmuwe; blur:O22p3e; contextmenu:mg9Pef;" jsname="LgbsSe" aria-label="Sort by" aria-haspopup="true" style="-webkit-tap-highlight-color: rgba(0, 0, 0, 0); -webkit-font-smoothing: antialiased; font-family: &quot;Google Sans&quot;, Roboto, Arial, sans-serif; font-size: 0.875rem; letter-spacing: 0.0107143em; text-decoration: var(--mdc-typography-button-text-decoration,none); position: relative; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box; min-width: 50px; border-width: initial; border-style: none; border-color: initial; outline: none; line-height: inherit; user-select: none; appearance: none; overflow: visible; vertical-align: middle; margin-top: 6px; margin-bottom: 6px; --mdc-ripple-fg-size:0; --mdc-ripple-left:0; --mdc-ripple-top:0; --mdc-ripple-fg-scale:1; --mdc-ripple-fg-translate-end:0; --mdc-ripple-fg-translate-start:0; will-change: transform, opacity; height: 36px; border-radius: var(--mdc-shape-small,4px); padding: 0px 24px; white-space: nowrap;"><div class="VfPpkd-Jh9lGc" style="-webkit-tap-highlight-color: transparent; position: absolute; box-sizing: content-box; width: 139.766px; height: 36px; overflow: hidden; border-radius: var(--mdc-shape-small,4px); z-index: 0; top: 0px; left: 0px;"></div><span jsname="V67aGc" class="VfPpkd-vQzf8d" aria-hidden="true" style="-webkit-tap-highlight-color: transparent; position: relative;">Sort by:</span><svg width="24" height="24" viewBox="0 0 24 24" focusable="false" class="FpEi8e NMm5M"><path d="M4 7l1.41 1.41L8 5.83V13h2V5.83l2.59 2.58L14 7 9 2 4 7zm16 10l-1.41-1.41L16 18.17V11h-2v7.17l-2.59-2.58L10 17l5 5 5-5z"></path></svg><div class="VfPpkd-RLmnJb" style="-webkit-tap-highlight-color: transparent; position: absolute; top: 18px; right: 0px; height: 48px; left: 0px; transform: translateY(-50%);"></div></button></div></div></div><div jsname="Y8PVec" style="-webkit-tap-highlight-color: transparent;"></div></div></div></div></div></div></div></div><div jsname="AqkRyc" style="-webkit-tap-highlight-color: transparent; color: rgb(95, 99, 104); font-family: Roboto, Arial, sans-serif; font-size: 14px; letter-spacing: 0.2px;"><div jsaction="bSWuu:LNIQib;SWjuFd:qSa2f;DlTLN:ICSa3;" class="VKb8lb H4aYKc" role="list" style="-webkit-tap-highlight-color: transparent; list-style-type: none; margin: 0px 0px 16px; padding: 0px;"><div class="mz0jqb taHBqe Qpcsfe" jsname="ueLGWe" data-id="xr9XKd" role="listitem" style="-webkit-tap-highlight-color: transparent; transition: opacity 300ms cubic-bezier(0.4, 0, 0.2, 1) 0s, margin 300ms ease-in-out 0s, border-radius 100ms ease-in-out 200ms; border-left: 1px solid rgb(218, 220, 224); border-right: 1px solid rgb(218, 220, 224); border-top: 1px solid rgb(218, 220, 224); border-radius: 8px 8px 0px 0px;"><div jsname="lwc3Jf" jscontroller="Lqaaf" class="E2ZmUe" data-slice-id="xr9XKd" data-collapsedlabel="Open more details." data-expandedlabel="Flight with Frontier. Economy, Airbus A320, flight number F9 2983. Below average legroom (28 inches).  Close details." data-withmodel="true" style="-webkit-tap-highlight-color: transparent; display: grid; grid-template-columns: minmax(0px, 1fr); grid-template-rows: auto auto; position: relative;"><div class="KC3CM" jsaction="click:O1htCb;" tabindex="0" role="button" aria-label="From 49 US dollars round trip total.This price does not include overhead bin access. Nonstop flight with Frontier. Leaves Baltimore/Washington International Thurgood Marshall Airport at 6:30 AM on Monday, April 19 and arrives at Miami International Airport at 9:15 AM on Monday, April 19. Total duration 2 hr 45 min.  Select flight" jslog="8478;ved:0CAAQnkIoAGoXChMIsPXgrY3S7wIVAAAAAB0AAAAAEA8;track:click" jsname="BXUrOb" style="-webkit-tap-highlight-color: transparent; cursor: pointer; grid-column-start: 1; grid-row-start: 1; padding-right: 72px; padding-bottom: 16px; padding-top: 16px;"><div class="mxvQLc ceis6c" jsname="HSrbLb" style="-webkit-tap-highlight-color: transparent; display: grid; flex: 1 1 auto; grid-template-columns: 1fr; grid-template-rows: auto; padding: 0px 8px 0px 24px;"><div class="OgQvJf nKlB3b" style="-webkit-tap-highlight-color: transparent; display: flex; grid-column-start: 1; grid-row-start: 1; min-width: 0px; height: 40px;"><div class="x8klId I11szd" style="-webkit-tap-highlight-color: transparent; margin-top: 1px; width: 68px;"><img src="https://www.gstatic.com/flights/airline_logos/70px/F9.png" alt="" class="EbY4Pc" data-iml="4904.689999995753" style="-webkit-tap-highlight-color: transparent; border: none; height: 35px; width: 35px;"></div><div class="Ir0Voe" style="-webkit-tap-highlight-color: transparent; flex: 0 0 35%; margin-right: 8px; min-width: 150px;"><div class="zxVSec YMlIz tPgKwe ogfYpf" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 16px; line-height: 20px; font-family: &quot;Google Sans&quot;, Roboto, Arial, sans-serif; letter-spacing: 0.1px; color: rgb(32, 33, 36); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;"><span class="mv1WYe" aria-label="Leaves Baltimore/Washington International Thurgood Marshall Airport at 6:30 AM on Monday, April 19 and arrives at Miami International Airport at 9:15 AM on Monday, April 19." style="-webkit-tap-highlight-color: transparent; display: inline-flex;"><g-bubble jscontroller="BlFnV" data-ci="" data-df="" data-h="" data-tp="5" jsaction="mouseenter:jTlRtf; mouseleave:JDTRYd;" jsshadow="" style="-webkit-tap-highlight-color: transparent;"><span jsname="d6wfac" class="CrAOse-hSRGPd CrAOse-hSRGPd-TGB85e-cOuCgd" data-extra-container-classes="EQDr2d gQSlLe V4aGXc WSILo" data-extra-triangle-classes="aTf4cb eN65Ce Txwrvb" data-hover-hide-delay="1000" data-hover-open-delay="500" data-keep-bubble-open-on-hover="" data-theme="0" data-width="0" jsaction="vQLyHf" jsslot="" style="-webkit-tap-highlight-color: transparent; cursor: pointer; pointer-events: none;">6:30 AM</span></g-bubble>&nbsp;–&nbsp;<g-bubble jscontroller="BlFnV" data-ci="" data-df="" data-h="" data-tp="5" jsaction="mouseenter:jTlRtf; mouseleave:JDTRYd;" jsshadow="" style="-webkit-tap-highlight-color: transparent;"><span jsname="d6wfac" class="CrAOse-hSRGPd CrAOse-hSRGPd-TGB85e-cOuCgd" data-extra-container-classes="EQDr2d gQSlLe V4aGXc WSILo" data-extra-triangle-classes="aTf4cb eN65Ce Txwrvb" data-hover-hide-delay="1000" data-hover-open-delay="500" data-keep-bubble-open-on-hover="" data-theme="0" data-width="0" jsaction="vQLyHf" jsslot="" style="-webkit-tap-highlight-color: transparent; cursor: pointer; pointer-events: none;">9:15 AM</span></g-bubble></span></div><div class="TQqf0e sSHqwe tPgKwe ogfYpf" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 12px; line-height: 16px; letter-spacing: 0.3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><span style="-webkit-tap-highlight-color: transparent;">Frontier</span></div></div><div class="Ak5kof" style="-webkit-tap-highlight-color: transparent; flex: 5 1 0%; line-height: 0; min-width: 0px; white-space: nowrap;"><div class="gvkrdb AdWm1c tPgKwe ogfYpf" aria-label="Total duration 2 hr 45 min." style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 16px; line-height: 20px; font-family: &quot;Google Sans&quot;, Roboto, Arial, sans-serif; letter-spacing: 0.1px; color: rgb(32, 33, 36); overflow: hidden; text-overflow: ellipsis;">2 hr 45 min</div><span class="z0fuv sSHqwe tPgKwe ogfYpf" aria-hidden="true" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 12px; line-height: 16px; letter-spacing: 0.3px; overflow: hidden; text-overflow: ellipsis;"><g-bubble jscontroller="BlFnV" data-ci="" data-df="" data-h="" jsaction="mouseenter:jTlRtf; mouseleave:JDTRYd;" jsshadow="" style="-webkit-tap-highlight-color: transparent;"><span jsname="d6wfac" class="CrAOse-hSRGPd CrAOse-hSRGPd-TGB85e-cOuCgd" data-extra-container-classes="EQDr2d gQSlLe V4aGXc WSILo" data-extra-triangle-classes="aTf4cb eN65Ce Txwrvb" data-hover-hide-delay="1000" data-hover-open-delay="500" data-keep-bubble-open-on-hover="" data-theme="0" data-width="0" jsaction="vQLyHf" jsslot="" style="-webkit-tap-highlight-color: transparent; cursor: pointer; pointer-events: none;">BWI</span></g-bubble>–<g-bubble jscontroller="BlFnV" data-ci="" data-df="" data-h="" jsaction="mouseenter:jTlRtf; mouseleave:JDTRYd;" jsshadow="" style="-webkit-tap-highlight-color: transparent;"><span jsname="d6wfac" class="CrAOse-hSRGPd CrAOse-hSRGPd-TGB85e-cOuCgd" data-extra-container-classes="EQDr2d gQSlLe V4aGXc WSILo" data-extra-triangle-classes="aTf4cb eN65Ce Txwrvb" data-hover-hide-delay="1000" data-hover-open-delay="500" data-keep-bubble-open-on-hover="" data-theme="0" data-width="0" jsaction="vQLyHf" jsslot="" style="-webkit-tap-highlight-color: transparent; cursor: pointer; pointer-events: none;">MIA</span></g-bubble></span></div><div class="BbR8Ec" style="-webkit-tap-highlight-color: transparent; min-width: 0px; white-space: nowrap; flex: 4 1 0%;"><div class="EfT7Ae AdWm1c tPgKwe" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 16px; line-height: 20px; font-family: &quot;Google Sans&quot;, Roboto, Arial, sans-serif; letter-spacing: 0.1px; color: rgb(32, 33, 36); display: flex;"><span class="pIgMWd ogfYpf" aria-label="Nonstop flight." style="-webkit-tap-highlight-color: transparent; overflow: hidden; text-overflow: ellipsis;">Nonstop</span></div><div class="nQgyaf sSHqwe tPgKwe ogfYpf" aria-label="" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 12px; line-height: 16px; letter-spacing: 0.3px; overflow: hidden; text-overflow: ellipsis;"></div></div><div class="y0NSEe V1iAHe tPgKwe ogfYpf" style="-webkit-tap-highlight-color: transparent; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; justify-content: space-between; flex: 4 1 0%;"></div><div class="U3gSDe" style="-webkit-tap-highlight-color: transparent; flex: 4 1 0%;"><div class="BVAVmf I11szd POX3ye" style="-webkit-tap-highlight-color: transparent; place-content: center flex-end; display: flex; justify-self: end; margin-left: 8px;"><div class="JMnxgf" style="-webkit-tap-highlight-color: transparent; align-items: center; display: flex; height: 24px;"><g-bubble jscontroller="BlFnV" data-ci="" data-df="" data-h="" data-tp="5" jsaction="mouseenter:jTlRtf; mouseleave:JDTRYd; click:NLMyWb;" jsshadow="" style="-webkit-tap-highlight-color: transparent;"><span jsname="d6wfac" class="CrAOse-hSRGPd CrAOse-hSRGPd-TGB85e-cOuCgd" data-extra-container-classes="EQDr2d gQSlLe WSILo" data-extra-triangle-classes="aTf4cb eN65Ce Txwrvb" data-hover-hide-delay="1000" data-hover-open-delay="500" data-keep-bubble-open-on-hover="" data-theme="0" data-width="235" jsaction="vQLyHf" jsslot="" style="-webkit-tap-highlight-color: transparent; cursor: pointer; pointer-events: none;"><div style="-webkit-tap-highlight-color: transparent;"><svg width="24" height="24" viewBox="0 0 24 24" focusable="false" class="vmWDCc NMm5M"><path d="M9.52 4.1a.55.55 0 01.48-.59h4a.55.55 0 01.48.59V11h-.65L18 15.15V12a1.1 1.1 0 00-1-1h-1V3.53A1.44 1.44 0 0014.53 2H9.47A1.43 1.43 0 008 3.53v1.62l1.51 1.51zM18 18l-7-7-1.49-1.51L8 8 3.51 3.49 2.1 4.91l5.9 5.9V11H7a1.1 1.1 0 00-1 1v7.61a.85.85 0 00.88.83H8v.82a.75.75 0 00.77.74.73.73 0 00.74-.74v-.84h5v.82a.76.76 0 001.51 0v-.82h1.12a.84.84 0 00.41-.11l1.54 1.55 1.42-1.42z"></path><path d="M0 0h24v24H0z" fill="none"></path></svg></div></span></g-bubble></div><div class="YMlIz FpEdX jLMuyc" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 16px; line-height: 20px; font-family: &quot;Google Sans&quot;, Roboto, Arial, sans-serif; letter-spacing: 0.1px; color: rgb(24, 128, 56); text-align: right; white-space: nowrap;"><span data-gs="CjRIVmFkNFk4bDdHT1lBQ1k1VkFCRy0tLS0tLS0tLXlzamcyMUFBQUFBR0JmXy1JRE1qOEFBEgZGOTI5ODMaCgiSJhACGgNVU0Q4HHCSJg==" aria-label="49 US dollars" role="text" style="-webkit-tap-highlight-color: transparent;">$49</span></div></div><div class="N872Rd sSHqwe I11szd POX3ye" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 12px; line-height: 16px; letter-spacing: 0.3px; margin-left: 8px; text-align: right;">round trip</div></div></div></div></div><div class="wENlyf" jsaction="click:ornU0b;focus:AHmuwe; blur:O22p3e; mouseup:GfWc1e; touchend:GfWc1e;" data-log-itinerary-details-toggle="true" tabindex="0" role="button" aria-expanded="false" aria-controls="c23" aria-label="Open more details." jsname="orkmT" style="-webkit-tap-highlight-color: transparent; align-items: center; cursor: pointer; display: flex; justify-content: center; outline: none; position: absolute; right: 0px; z-index: 1; border-radius: 100%; height: 40px; margin: 0px 16px; top: 16px; width: 40px;"><svg width="24" height="24" viewBox="0 0 24 24" focusable="false" class="av4PG NMm5M"><path d="M12 16.41l-6.71-6.7 1.42-1.42 5.29 5.3 5.29-5.3 1.42 1.42z"></path></svg><div class="xKbyce" style="-webkit-tap-highlight-color: transparent; height: 48px; position: absolute; width: 48px;"></div></div><div jsname="QqrbJb" data-ved="0CAEQ2qcCahcKEwiw9eCtjdLvAhUAAAAAHQAAAAAQDw" class="TJMsde" style="-webkit-tap-highlight-color: transparent; height: 0px; width: 0px;"></div><div jsname="cYBlNc" data-ved="0CAIQ1qcCahcKEwiw9eCtjdLvAhUAAAAAHQAAAAAQDw" class="TJMsde" style="-webkit-tap-highlight-color: transparent; height: 0px; width: 0px;"></div></div></div><div class="mz0jqb taHBqe Qpcsfe" jsname="ueLGWe" data-id="uVBGOc" role="listitem" style="-webkit-tap-highlight-color: transparent; border-top: 1px solid rgb(218, 220, 224); transition: opacity 300ms cubic-bezier(0.4, 0, 0.2, 1) 0s, margin 300ms ease-in-out 0s, border-radius 100ms ease-in-out 200ms; border-left: 1px solid rgb(218, 220, 224); border-right: 1px solid rgb(218, 220, 224);"><div jsname="lwc3Jf" jscontroller="Lqaaf" class="E2ZmUe" data-slice-id="uVBGOc" data-collapsedlabel="Open more details." data-expandedlabel="Flight with Spirit. Economy, Airbus A320, flight number NK 307. Below average legroom (28 inches).  Close details." data-withmodel="true" style="-webkit-tap-highlight-color: transparent; display: grid; grid-template-columns: minmax(0px, 1fr); grid-template-rows: auto auto; position: relative;"><div class="KC3CM" jsaction="click:O1htCb;" tabindex="0" role="button" aria-label="From 80 US dollars round trip total.This price does not include overhead bin access. Nonstop flight with Spirit. Leaves Baltimore/Washington International Thurgood Marshall Airport at 6:15 AM on Monday, April 19 and arrives at Fort Lauderdale-Hollywood International Airport at 8:49 AM on Monday, April 19. Total duration 2 hr 34 min.  Select flight" jslog="8478;ved:0CAMQnkIoAWoXChMIsPXgrY3S7wIVAAAAAB0AAAAAEA8;track:click" jsname="BXUrOb" style="-webkit-tap-highlight-color: transparent; cursor: pointer; grid-column-start: 1; grid-row-start: 1; padding-right: 72px; padding-bottom: 16px; padding-top: 16px;"><div class="mxvQLc ceis6c" jsname="HSrbLb" style="-webkit-tap-highlight-color: transparent; display: grid; flex: 1 1 auto; grid-template-columns: 1fr; grid-template-rows: auto; padding: 0px 8px 0px 24px;"><div class="OgQvJf nKlB3b" style="-webkit-tap-highlight-color: transparent; display: flex; grid-column-start: 1; grid-row-start: 1; min-width: 0px; height: 40px;"><div class="x8klId I11szd" style="-webkit-tap-highlight-color: transparent; margin-top: 1px; width: 68px;"><img src="https://www.gstatic.com/flights/airline_logos/70px/NK.png" alt="" class="EbY4Pc" data-iml="4978.52000000421" style="-webkit-tap-highlight-color: transparent; border: none; height: 35px; width: 35px;"></div><div class="Ir0Voe" style="-webkit-tap-highlight-color: transparent; flex: 0 0 35%; margin-right: 8px; min-width: 150px;"><div class="zxVSec YMlIz tPgKwe ogfYpf" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 16px; line-height: 20px; font-family: &quot;Google Sans&quot;, Roboto, Arial, sans-serif; letter-spacing: 0.1px; color: rgb(32, 33, 36); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;"><span class="mv1WYe" aria-label="Leaves Baltimore/Washington International Thurgood Marshall Airport at 6:15 AM on Monday, April 19 and arrives at Fort Lauderdale-Hollywood International Airport at 8:49 AM on Monday, April 19." style="-webkit-tap-highlight-color: transparent; display: inline-flex;"><g-bubble jscontroller="BlFnV" data-ci="" data-df="" data-h="" data-tp="5" jsaction="mouseenter:jTlRtf; mouseleave:JDTRYd;" jsshadow="" style="-webkit-tap-highlight-color: transparent;"><span jsname="d6wfac" class="CrAOse-hSRGPd CrAOse-hSRGPd-TGB85e-cOuCgd" data-extra-container-classes="EQDr2d gQSlLe V4aGXc WSILo" data-extra-triangle-classes="aTf4cb eN65Ce Txwrvb" data-hover-hide-delay="1000" data-hover-open-delay="500" data-keep-bubble-open-on-hover="" data-theme="0" data-width="0" jsaction="vQLyHf" jsslot="" style="-webkit-tap-highlight-color: transparent; cursor: pointer; pointer-events: none;">6:15 AM</span></g-bubble>&nbsp;–&nbsp;<g-bubble jscontroller="BlFnV" data-ci="" data-df="" data-h="" data-tp="5" jsaction="mouseenter:jTlRtf; mouseleave:JDTRYd;" jsshadow="" style="-webkit-tap-highlight-color: transparent;"><span jsname="d6wfac" class="CrAOse-hSRGPd CrAOse-hSRGPd-TGB85e-cOuCgd" data-extra-container-classes="EQDr2d gQSlLe V4aGXc WSILo" data-extra-triangle-classes="aTf4cb eN65Ce Txwrvb" data-hover-hide-delay="1000" data-hover-open-delay="500" data-keep-bubble-open-on-hover="" data-theme="0" data-width="0" jsaction="vQLyHf" jsslot="" style="-webkit-tap-highlight-color: transparent; cursor: pointer; pointer-events: none;">8:49 AM</span></g-bubble></span></div><div class="TQqf0e sSHqwe tPgKwe ogfYpf" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 12px; line-height: 16px; letter-spacing: 0.3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><span style="-webkit-tap-highlight-color: transparent;">Spirit</span></div></div><div class="Ak5kof" style="-webkit-tap-highlight-color: transparent; flex: 5 1 0%; line-height: 0; min-width: 0px; white-space: nowrap;"><div class="gvkrdb AdWm1c tPgKwe ogfYpf" aria-label="Total duration 2 hr 34 min." style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 16px; line-height: 20px; font-family: &quot;Google Sans&quot;, Roboto, Arial, sans-serif; letter-spacing: 0.1px; color: rgb(32, 33, 36); overflow: hidden; text-overflow: ellipsis;">2 hr 34 min</div><span class="z0fuv sSHqwe tPgKwe ogfYpf" aria-hidden="true" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 12px; line-height: 16px; letter-spacing: 0.3px; overflow: hidden; text-overflow: ellipsis;"><g-bubble jscontroller="BlFnV" data-ci="" data-df="" data-h="" jsaction="mouseenter:jTlRtf; mouseleave:JDTRYd;" jsshadow="" style="-webkit-tap-highlight-color: transparent;"><span jsname="d6wfac" class="CrAOse-hSRGPd CrAOse-hSRGPd-TGB85e-cOuCgd" data-extra-container-classes="EQDr2d gQSlLe V4aGXc WSILo" data-extra-triangle-classes="aTf4cb eN65Ce Txwrvb" data-hover-hide-delay="1000" data-hover-open-delay="500" data-keep-bubble-open-on-hover="" data-theme="0" data-width="0" jsaction="vQLyHf" jsslot="" style="-webkit-tap-highlight-color: transparent; cursor: pointer; pointer-events: none;">BWI</span></g-bubble>–<g-bubble jscontroller="BlFnV" data-ci="" data-df="" data-h="" jsaction="mouseenter:jTlRtf; mouseleave:JDTRYd;" jsshadow="" style="-webkit-tap-highlight-color: transparent;"><span jsname="d6wfac" class="CrAOse-hSRGPd CrAOse-hSRGPd-TGB85e-cOuCgd" data-extra-container-classes="EQDr2d gQSlLe V4aGXc WSILo" data-extra-triangle-classes="aTf4cb eN65Ce Txwrvb" data-hover-hide-delay="1000" data-hover-open-delay="500" data-keep-bubble-open-on-hover="" data-theme="0" data-width="0" jsaction="vQLyHf" jsslot="" style="-webkit-tap-highlight-color: transparent; cursor: pointer; pointer-events: none;">FLL</span></g-bubble></span></div><div class="BbR8Ec" style="-webkit-tap-highlight-color: transparent; min-width: 0px; white-space: nowrap; flex: 4 1 0%;"><div class="EfT7Ae AdWm1c tPgKwe" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 16px; line-height: 20px; font-family: &quot;Google Sans&quot;, Roboto, Arial, sans-serif; letter-spacing: 0.1px; color: rgb(32, 33, 36); display: flex;"><span class="pIgMWd ogfYpf" aria-label="Nonstop flight." style="-webkit-tap-highlight-color: transparent; overflow: hidden; text-overflow: ellipsis;">Nonstop</span></div><div class="nQgyaf sSHqwe tPgKwe ogfYpf" aria-label="" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 12px; line-height: 16px; letter-spacing: 0.3px; overflow: hidden; text-overflow: ellipsis;"></div></div><div class="y0NSEe V1iAHe tPgKwe ogfYpf" style="-webkit-tap-highlight-color: transparent; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; justify-content: space-between; flex: 4 1 0%;"></div><div class="U3gSDe" style="-webkit-tap-highlight-color: transparent; flex: 4 1 0%;"><div class="BVAVmf I11szd POX3ye" style="-webkit-tap-highlight-color: transparent; place-content: center flex-end; display: flex; justify-self: end; margin-left: 8px;"><div class="JMnxgf" style="-webkit-tap-highlight-color: transparent; align-items: center; display: flex; height: 24px;"><g-bubble jscontroller="BlFnV" data-ci="" data-df="" data-h="" data-tp="5" jsaction="mouseenter:jTlRtf; mouseleave:JDTRYd; click:NLMyWb;" jsshadow="" style="-webkit-tap-highlight-color: transparent;"><span jsname="d6wfac" class="CrAOse-hSRGPd CrAOse-hSRGPd-TGB85e-cOuCgd" data-extra-container-classes="EQDr2d gQSlLe WSILo" data-extra-triangle-classes="aTf4cb eN65Ce Txwrvb" data-hover-hide-delay="1000" data-hover-open-delay="500" data-keep-bubble-open-on-hover="" data-theme="0" data-width="235" jsaction="vQLyHf" jsslot="" style="-webkit-tap-highlight-color: transparent; cursor: pointer; pointer-events: none;"><div style="-webkit-tap-highlight-color: transparent;"><svg width="24" height="24" viewBox="0 0 24 24" focusable="false" class="vmWDCc NMm5M"><path d="M9.52 4.1a.55.55 0 01.48-.59h4a.55.55 0 01.48.59V11h-.65L18 15.15V12a1.1 1.1 0 00-1-1h-1V3.53A1.44 1.44 0 0014.53 2H9.47A1.43 1.43 0 008 3.53v1.62l1.51 1.51zM18 18l-7-7-1.49-1.51L8 8 3.51 3.49 2.1 4.91l5.9 5.9V11H7a1.1 1.1 0 00-1 1v7.61a.85.85 0 00.88.83H8v.82a.75.75 0 00.77.74.73.73 0 00.74-.74v-.84h5v.82a.76.76 0 001.51 0v-.82h1.12a.84.84 0 00.41-.11l1.54 1.55 1.42-1.42z"></path><path d="M0 0h24v24H0z" fill="none"></path></svg></div></span></g-bubble></div><div class="YMlIz FpEdX" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 16px; line-height: 20px; font-family: &quot;Google Sans&quot;, Roboto, Arial, sans-serif; letter-spacing: 0.1px; color: rgb(32, 33, 36); text-align: right; white-space: nowrap;"><span data-gs="CjRIVmFkNFk4bDdHT1lBQ1k1VkFCRy0tLS0tLS0tLXlzamcyMUFBQUFBR0JmXy1JRE1qOEFBEgVOSzMwNxoKCMA+EAIaA1VTRDgccMA+" aria-label="80 US dollars" role="text" style="-webkit-tap-highlight-color: transparent;">$80</span></div></div><div class="N872Rd sSHqwe I11szd POX3ye" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 12px; line-height: 16px; letter-spacing: 0.3px; margin-left: 8px; text-align: right;">round trip</div></div></div></div></div><div class="wENlyf" jsaction="click:ornU0b;focus:AHmuwe; blur:O22p3e; mouseup:GfWc1e; touchend:GfWc1e;" data-log-itinerary-details-toggle="true" tabindex="0" role="button" aria-expanded="false" aria-controls="c24" aria-label="Open more details." jsname="orkmT" style="-webkit-tap-highlight-color: transparent; align-items: center; cursor: pointer; display: flex; justify-content: center; outline: none; position: absolute; right: 0px; z-index: 1; border-radius: 100%; height: 40px; margin: 0px 16px; top: 16px; width: 40px;"><svg width="24" height="24" viewBox="0 0 24 24" focusable="false" class="av4PG NMm5M"><path d="M12 16.41l-6.71-6.7 1.42-1.42 5.29 5.3 5.29-5.3 1.42 1.42z"></path></svg><div class="xKbyce" style="-webkit-tap-highlight-color: transparent; height: 48px; position: absolute; width: 48px;"></div></div><div jsname="QqrbJb" data-ved="0CAQQ2qcCahcKEwiw9eCtjdLvAhUAAAAAHQAAAAAQDw" class="TJMsde" style="-webkit-tap-highlight-color: transparent; height: 0px; width: 0px;"></div><div jsname="cYBlNc" data-ved="0CAUQ1qcCahcKEwiw9eCtjdLvAhUAAAAAHQAAAAAQDw" class="TJMsde" style="-webkit-tap-highlight-color: transparent; height: 0px; width: 0px;"></div></div></div><div class="mz0jqb taHBqe Qpcsfe" jsname="ueLGWe" data-id="P0wNId" role="listitem" style="-webkit-tap-highlight-color: transparent; border-top: 1px solid rgb(218, 220, 224); transition: opacity 300ms cubic-bezier(0.4, 0, 0.2, 1) 0s, margin 300ms ease-in-out 0s, border-radius 100ms ease-in-out 200ms; border-left: 1px solid rgb(218, 220, 224); border-right: 1px solid rgb(218, 220, 224);"><div jsname="lwc3Jf" jscontroller="Lqaaf" class="E2ZmUe" data-slice-id="P0wNId" data-collapsedlabel="Open more details." data-expandedlabel="Flight with Spirit. Economy, Airbus A320, flight number NK 2075. Below average legroom (28 inches).  Close details." data-withmodel="true" style="-webkit-tap-highlight-color: transparent; display: grid; grid-template-columns: minmax(0px, 1fr); grid-template-rows: auto auto; position: relative;"><div class="KC3CM" jsaction="click:O1htCb;" tabindex="0" role="button" aria-label="From 80 US dollars round trip total.This price does not include overhead bin access. Nonstop flight with Spirit. Leaves Baltimore/Washington International Thurgood Marshall Airport at 8:30 AM on Monday, April 19 and arrives at Fort Lauderdale-Hollywood International Airport at 11:04 AM on Monday, April 19. Total duration 2 hr 34 min.  Select flight" jslog="8478;ved:0CAYQnkIoAmoXChMIsPXgrY3S7wIVAAAAAB0AAAAAEA8;track:click" jsname="BXUrOb" style="-webkit-tap-highlight-color: transparent; cursor: pointer; grid-column-start: 1; grid-row-start: 1; padding-right: 72px; padding-bottom: 16px; padding-top: 16px;"><div class="mxvQLc ceis6c" jsname="HSrbLb" style="-webkit-tap-highlight-color: transparent; display: grid; flex: 1 1 auto; grid-template-columns: 1fr; grid-template-rows: auto; padding: 0px 8px 0px 24px;"><div class="OgQvJf nKlB3b" style="-webkit-tap-highlight-color: transparent; display: flex; grid-column-start: 1; grid-row-start: 1; min-width: 0px; height: 40px;"><div class="x8klId I11szd" style="-webkit-tap-highlight-color: transparent; margin-top: 1px; width: 68px;"><img src="https://www.gstatic.com/flights/airline_logos/70px/NK.png" alt="" class="EbY4Pc" data-iml="4978.304999996908" style="-webkit-tap-highlight-color: transparent; border: none; height: 35px; width: 35px;"></div><div class="Ir0Voe" style="-webkit-tap-highlight-color: transparent; flex: 0 0 35%; margin-right: 8px; min-width: 150px;"><div class="zxVSec YMlIz tPgKwe ogfYpf" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 16px; line-height: 20px; font-family: &quot;Google Sans&quot;, Roboto, Arial, sans-serif; letter-spacing: 0.1px; color: rgb(32, 33, 36); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;"><span class="mv1WYe" aria-label="Leaves Baltimore/Washington International Thurgood Marshall Airport at 8:30 AM on Monday, April 19 and arrives at Fort Lauderdale-Hollywood International Airport at 11:04 AM on Monday, April 19." style="-webkit-tap-highlight-color: transparent; display: inline-flex;"><g-bubble jscontroller="BlFnV" data-ci="" data-df="" data-h="" data-tp="5" jsaction="mouseenter:jTlRtf; mouseleave:JDTRYd;" jsshadow="" style="-webkit-tap-highlight-color: transparent;"><span jsname="d6wfac" class="CrAOse-hSRGPd CrAOse-hSRGPd-TGB85e-cOuCgd" data-extra-container-classes="EQDr2d gQSlLe V4aGXc WSILo" data-extra-triangle-classes="aTf4cb eN65Ce Txwrvb" data-hover-hide-delay="1000" data-hover-open-delay="500" data-keep-bubble-open-on-hover="" data-theme="0" data-width="0" jsaction="vQLyHf" jsslot="" style="-webkit-tap-highlight-color: transparent; cursor: pointer; pointer-events: none;">8:30 AM</span></g-bubble>&nbsp;–&nbsp;<g-bubble jscontroller="BlFnV" data-ci="" data-df="" data-h="" data-tp="5" jsaction="mouseenter:jTlRtf; mouseleave:JDTRYd;" jsshadow="" style="-webkit-tap-highlight-color: transparent;"><span jsname="d6wfac" class="CrAOse-hSRGPd CrAOse-hSRGPd-TGB85e-cOuCgd" data-extra-container-classes="EQDr2d gQSlLe V4aGXc WSILo" data-extra-triangle-classes="aTf4cb eN65Ce Txwrvb" data-hover-hide-delay="1000" data-hover-open-delay="500" data-keep-bubble-open-on-hover="" data-theme="0" data-width="0" jsaction="vQLyHf" jsslot="" style="-webkit-tap-highlight-color: transparent; cursor: pointer; pointer-events: none;">11:04 AM</span></g-bubble></span></div><div class="TQqf0e sSHqwe tPgKwe ogfYpf" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 12px; line-height: 16px; letter-spacing: 0.3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><span style="-webkit-tap-highlight-color: transparent;">Spirit</span></div></div><div class="Ak5kof" style="-webkit-tap-highlight-color: transparent; flex: 5 1 0%; line-height: 0; min-width: 0px; white-space: nowrap;"><div class="gvkrdb AdWm1c tPgKwe ogfYpf" aria-label="Total duration 2 hr 34 min." style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 16px; line-height: 20px; font-family: &quot;Google Sans&quot;, Roboto, Arial, sans-serif; letter-spacing: 0.1px; color: rgb(32, 33, 36); overflow: hidden; text-overflow: ellipsis;">2 hr 34 min</div><span class="z0fuv sSHqwe tPgKwe ogfYpf" aria-hidden="true" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 12px; line-height: 16px; letter-spacing: 0.3px; overflow: hidden; text-overflow: ellipsis;"><g-bubble jscontroller="BlFnV" data-ci="" data-df="" data-h="" jsaction="mouseenter:jTlRtf; mouseleave:JDTRYd;" jsshadow="" style="-webkit-tap-highlight-color: transparent;"><span jsname="d6wfac" class="CrAOse-hSRGPd CrAOse-hSRGPd-TGB85e-cOuCgd" data-extra-container-classes="EQDr2d gQSlLe V4aGXc WSILo" data-extra-triangle-classes="aTf4cb eN65Ce Txwrvb" data-hover-hide-delay="1000" data-hover-open-delay="500" data-keep-bubble-open-on-hover="" data-theme="0" data-width="0" jsaction="vQLyHf" jsslot="" style="-webkit-tap-highlight-color: transparent; cursor: pointer; pointer-events: none;">BWI</span></g-bubble>–<g-bubble jscontroller="BlFnV" data-ci="" data-df="" data-h="" jsaction="mouseenter:jTlRtf; mouseleave:JDTRYd;" jsshadow="" style="-webkit-tap-highlight-color: transparent;"><span jsname="d6wfac" class="CrAOse-hSRGPd CrAOse-hSRGPd-TGB85e-cOuCgd" data-extra-container-classes="EQDr2d gQSlLe V4aGXc WSILo" data-extra-triangle-classes="aTf4cb eN65Ce Txwrvb" data-hover-hide-delay="1000" data-hover-open-delay="500" data-keep-bubble-open-on-hover="" data-theme="0" data-width="0" jsaction="vQLyHf" jsslot="" style="-webkit-tap-highlight-color: transparent; cursor: pointer; pointer-events: none;">FLL</span></g-bubble></span></div><div class="BbR8Ec" style="-webkit-tap-highlight-color: transparent; min-width: 0px; white-space: nowrap; flex: 4 1 0%;"><div class="EfT7Ae AdWm1c tPgKwe" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 16px; line-height: 20px; font-family: &quot;Google Sans&quot;, Roboto, Arial, sans-serif; letter-spacing: 0.1px; color: rgb(32, 33, 36); display: flex;"><span class="pIgMWd ogfYpf" aria-label="Nonstop flight." style="-webkit-tap-highlight-color: transparent; overflow: hidden; text-overflow: ellipsis;">Nonstop</span></div><div class="nQgyaf sSHqwe tPgKwe ogfYpf" aria-label="" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 12px; line-height: 16px; letter-spacing: 0.3px; overflow: hidden; text-overflow: ellipsis;"></div></div><div class="y0NSEe V1iAHe tPgKwe ogfYpf" style="-webkit-tap-highlight-color: transparent; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; justify-content: space-between; flex: 4 1 0%;"></div><div class="U3gSDe" style="-webkit-tap-highlight-color: transparent; flex: 4 1 0%;"><div class="BVAVmf I11szd POX3ye" style="-webkit-tap-highlight-color: transparent; place-content: center flex-end; display: flex; justify-self: end; margin-left: 8px;"><div class="JMnxgf" style="-webkit-tap-highlight-color: transparent; align-items: center; display: flex; height: 24px;"><g-bubble jscontroller="BlFnV" data-ci="" data-df="" data-h="" data-tp="5" jsaction="mouseenter:jTlRtf; mouseleave:JDTRYd; click:NLMyWb;" jsshadow="" style="-webkit-tap-highlight-color: transparent;"><span jsname="d6wfac" class="CrAOse-hSRGPd CrAOse-hSRGPd-TGB85e-cOuCgd" data-extra-container-classes="EQDr2d gQSlLe WSILo" data-extra-triangle-classes="aTf4cb eN65Ce Txwrvb" data-hover-hide-delay="1000" data-hover-open-delay="500" data-keep-bubble-open-on-hover="" data-theme="0" data-width="235" jsaction="vQLyHf" jsslot="" style="-webkit-tap-highlight-color: transparent; cursor: pointer; pointer-events: none;"><div style="-webkit-tap-highlight-color: transparent;"><svg width="24" height="24" viewBox="0 0 24 24" focusable="false" class="vmWDCc NMm5M"><path d="M9.52 4.1a.55.55 0 01.48-.59h4a.55.55 0 01.48.59V11h-.65L18 15.15V12a1.1 1.1 0 00-1-1h-1V3.53A1.44 1.44 0 0014.53 2H9.47A1.43 1.43 0 008 3.53v1.62l1.51 1.51zM18 18l-7-7-1.49-1.51L8 8 3.51 3.49 2.1 4.91l5.9 5.9V11H7a1.1 1.1 0 00-1 1v7.61a.85.85 0 00.88.83H8v.82a.75.75 0 00.77.74.73.73 0 00.74-.74v-.84h5v.82a.76.76 0 001.51 0v-.82h1.12a.84.84 0 00.41-.11l1.54 1.55 1.42-1.42z"></path><path d="M0 0h24v24H0z" fill="none"></path></svg></div></span></g-bubble></div><div class="YMlIz FpEdX" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 16px; line-height: 20px; font-family: &quot;Google Sans&quot;, Roboto, Arial, sans-serif; letter-spacing: 0.1px; color: rgb(32, 33, 36); text-align: right; white-space: nowrap;"><span data-gs="CjRIVmFkNFk4bDdHT1lBQ1k1VkFCRy0tLS0tLS0tLXlzamcyMUFBQUFBR0JmXy1JRE1qOEFBEgZOSzIwNzUaCgjAPhACGgNVU0Q4HHDAPg==" aria-label="80 US dollars" role="text" style="-webkit-tap-highlight-color: transparent;">$80</span></div></div><div class="N872Rd sSHqwe I11szd POX3ye" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 12px; line-height: 16px; letter-spacing: 0.3px; margin-left: 8px; text-align: right;">round trip</div></div></div></div></div><div class="wENlyf" jsaction="click:ornU0b;focus:AHmuwe; blur:O22p3e; mouseup:GfWc1e; touchend:GfWc1e;" data-log-itinerary-details-toggle="true" tabindex="0" role="button" aria-expanded="false" aria-controls="c25" aria-label="Open more details." jsname="orkmT" style="-webkit-tap-highlight-color: transparent; align-items: center; cursor: pointer; display: flex; justify-content: center; outline: none; position: absolute; right: 0px; z-index: 1; border-radius: 100%; height: 40px; margin: 0px 16px; top: 16px; width: 40px;"><svg width="24" height="24" viewBox="0 0 24 24" focusable="false" class="av4PG NMm5M"><path d="M12 16.41l-6.71-6.7 1.42-1.42 5.29 5.3 5.29-5.3 1.42 1.42z"></path></svg><div class="xKbyce" style="-webkit-tap-highlight-color: transparent; height: 48px; position: absolute; width: 48px;"></div></div><div jsname="QqrbJb" data-ved="0CAcQ2qcCahcKEwiw9eCtjdLvAhUAAAAAHQAAAAAQDw" class="TJMsde" style="-webkit-tap-highlight-color: transparent; height: 0px; width: 0px;"></div><div jsname="cYBlNc" data-ved="0CAgQ1qcCahcKEwiw9eCtjdLvAhUAAAAAHQAAAAAQDw" class="TJMsde" style="-webkit-tap-highlight-color: transparent; height: 0px; width: 0px;"></div></div></div><div class="mz0jqb taHBqe Qpcsfe" jsname="ueLGWe" data-id="Tbsfec" role="listitem" style="-webkit-tap-highlight-color: transparent; border-width: 1px; border-style: solid; border-color: rgb(218, 220, 224); transition: opacity 300ms cubic-bezier(0.4, 0, 0.2, 1) 0s, margin 300ms ease-in-out 0s, border-radius 100ms ease-in-out 200ms; border-radius: 0px 0px 8px 8px;"><div jsname="lwc3Jf" jscontroller="Lqaaf" class="E2ZmUe" data-slice-id="Tbsfec" data-collapsedlabel="Open more details." data-expandedlabel="Flight with Spirit. Economy, Airbus A321 (Sharklets), flight number NK 443. Below average legroom (28 inches).  Close details." data-withmodel="true" style="-webkit-tap-highlight-color: transparent; display: grid; grid-template-columns: minmax(0px, 1fr); grid-template-rows: auto auto; position: relative;"><div class="KC3CM" jsaction="click:O1htCb;" tabindex="0" role="button" aria-label="From 80 US dollars round trip total.This price does not include overhead bin access. Nonstop flight with Spirit. Leaves Baltimore/Washington International Thurgood Marshall Airport at 4:53 PM on Monday, April 19 and arrives at Fort Lauderdale-Hollywood International Airport at 7:29 PM on Monday, April 19. Total duration 2 hr 36 min.  Select flight" jslog="8478;ved:0CAkQnkIoA2oXChMIsPXgrY3S7wIVAAAAAB0AAAAAEA8;track:click" jsname="BXUrOb" style="-webkit-tap-highlight-color: transparent; cursor: pointer; grid-column-start: 1; grid-row-start: 1; padding-right: 72px; padding-bottom: 16px; padding-top: 16px;"><div class="mxvQLc ceis6c" jsname="HSrbLb" style="-webkit-tap-highlight-color: transparent; display: grid; flex: 1 1 auto; grid-template-columns: 1fr; grid-template-rows: auto; padding: 0px 8px 0px 24px;"><div class="OgQvJf nKlB3b" style="-webkit-tap-highlight-color: transparent; display: flex; grid-column-start: 1; grid-row-start: 1; min-width: 0px; height: 40px;"><div class="x8klId I11szd" style="-webkit-tap-highlight-color: transparent; margin-top: 1px; width: 68px;"><img src="https://www.gstatic.com/flights/airline_logos/70px/NK.png" alt="" class="EbY4Pc" data-iml="4978.390000003856" style="-webkit-tap-highlight-color: transparent; border: none; height: 35px; width: 35px;"></div><div class="Ir0Voe" style="-webkit-tap-highlight-color: transparent; flex: 0 0 35%; margin-right: 8px; min-width: 150px;"><div class="zxVSec YMlIz tPgKwe ogfYpf" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 16px; line-height: 20px; font-family: &quot;Google Sans&quot;, Roboto, Arial, sans-serif; letter-spacing: 0.1px; color: rgb(32, 33, 36); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle;"><span class="mv1WYe" aria-label="Leaves Baltimore/Washington International Thurgood Marshall Airport at 4:53 PM on Monday, April 19 and arrives at Fort Lauderdale-Hollywood International Airport at 7:29 PM on Monday, April 19." style="-webkit-tap-highlight-color: transparent; display: inline-flex;"><g-bubble jscontroller="BlFnV" data-ci="" data-df="" data-h="" data-tp="5" jsaction="mouseenter:jTlRtf; mouseleave:JDTRYd;" jsshadow="" style="-webkit-tap-highlight-color: transparent;"><span jsname="d6wfac" class="CrAOse-hSRGPd CrAOse-hSRGPd-TGB85e-cOuCgd" data-extra-container-classes="EQDr2d gQSlLe V4aGXc WSILo" data-extra-triangle-classes="aTf4cb eN65Ce Txwrvb" data-hover-hide-delay="1000" data-hover-open-delay="500" data-keep-bubble-open-on-hover="" data-theme="0" data-width="0" jsaction="vQLyHf" jsslot="" style="-webkit-tap-highlight-color: transparent; cursor: pointer; pointer-events: none;">4:53 PM</span></g-bubble>&nbsp;–&nbsp;<g-bubble jscontroller="BlFnV" data-ci="" data-df="" data-h="" data-tp="5" jsaction="mouseenter:jTlRtf; mouseleave:JDTRYd;" jsshadow="" style="-webkit-tap-highlight-color: transparent;"><span jsname="d6wfac" class="CrAOse-hSRGPd CrAOse-hSRGPd-TGB85e-cOuCgd" data-extra-container-classes="EQDr2d gQSlLe V4aGXc WSILo" data-extra-triangle-classes="aTf4cb eN65Ce Txwrvb" data-hover-hide-delay="1000" data-hover-open-delay="500" data-keep-bubble-open-on-hover="" data-theme="0" data-width="0" jsaction="vQLyHf" jsslot="" style="-webkit-tap-highlight-color: transparent; cursor: pointer; pointer-events: none;">7:29 PM</span></g-bubble></span></div><div class="TQqf0e sSHqwe tPgKwe ogfYpf" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 12px; line-height: 16px; letter-spacing: 0.3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><span style="-webkit-tap-highlight-color: transparent;">Spirit</span></div></div><div class="Ak5kof" style="-webkit-tap-highlight-color: transparent; flex: 5 1 0%; line-height: 0; min-width: 0px; white-space: nowrap;"><div class="gvkrdb AdWm1c tPgKwe ogfYpf" aria-label="Total duration 2 hr 36 min." style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 16px; line-height: 20px; font-family: &quot;Google Sans&quot;, Roboto, Arial, sans-serif; letter-spacing: 0.1px; color: rgb(32, 33, 36); overflow: hidden; text-overflow: ellipsis;">2 hr 36 min</div><span class="z0fuv sSHqwe tPgKwe ogfYpf" aria-hidden="true" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 12px; line-height: 16px; letter-spacing: 0.3px; overflow: hidden; text-overflow: ellipsis;"><g-bubble jscontroller="BlFnV" data-ci="" data-df="" data-h="" jsaction="mouseenter:jTlRtf; mouseleave:JDTRYd;" jsshadow="" style="-webkit-tap-highlight-color: transparent;"><span jsname="d6wfac" class="CrAOse-hSRGPd CrAOse-hSRGPd-TGB85e-cOuCgd" data-extra-container-classes="EQDr2d gQSlLe V4aGXc WSILo" data-extra-triangle-classes="aTf4cb eN65Ce Txwrvb" data-hover-hide-delay="1000" data-hover-open-delay="500" data-keep-bubble-open-on-hover="" data-theme="0" data-width="0" jsaction="vQLyHf" jsslot="" style="-webkit-tap-highlight-color: transparent; cursor: pointer; pointer-events: none;">BWI</span></g-bubble>–<g-bubble jscontroller="BlFnV" data-ci="" data-df="" data-h="" jsaction="mouseenter:jTlRtf; mouseleave:JDTRYd;" jsshadow="" style="-webkit-tap-highlight-color: transparent;"><span jsname="d6wfac" class="CrAOse-hSRGPd CrAOse-hSRGPd-TGB85e-cOuCgd" data-extra-container-classes="EQDr2d gQSlLe V4aGXc WSILo" data-extra-triangle-classes="aTf4cb eN65Ce Txwrvb" data-hover-hide-delay="1000" data-hover-open-delay="500" data-keep-bubble-open-on-hover="" data-theme="0" data-width="0" jsaction="vQLyHf" jsslot="" style="-webkit-tap-highlight-color: transparent; cursor: pointer; pointer-events: none;">FLL</span></g-bubble></span></div><div class="BbR8Ec" style="-webkit-tap-highlight-color: transparent; min-width: 0px; white-space: nowrap; flex: 4 1 0%;"><div class="EfT7Ae AdWm1c tPgKwe" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 16px; line-height: 20px; font-family: &quot;Google Sans&quot;, Roboto, Arial, sans-serif; letter-spacing: 0.1px; color: rgb(32, 33, 36); display: flex;"><span class="pIgMWd ogfYpf" aria-label="Nonstop flight." style="-webkit-tap-highlight-color: transparent; overflow: hidden; text-overflow: ellipsis;">Nonstop</span></div><div class="nQgyaf sSHqwe tPgKwe ogfYpf" aria-label="" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 12px; line-height: 16px; letter-spacing: 0.3px; overflow: hidden; text-overflow: ellipsis;"></div></div><div class="y0NSEe V1iAHe tPgKwe ogfYpf" style="-webkit-tap-highlight-color: transparent; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; justify-content: space-between; flex: 4 1 0%;"></div><div class="U3gSDe" style="-webkit-tap-highlight-color: transparent; flex: 4 1 0%;"><div class="BVAVmf I11szd POX3ye" style="-webkit-tap-highlight-color: transparent; place-content: center flex-end; display: flex; justify-self: end; margin-left: 8px;"><div class="JMnxgf" style="-webkit-tap-highlight-color: transparent; align-items: center; display: flex; height: 24px;"><g-bubble jscontroller="BlFnV" data-ci="" data-df="" data-h="" data-tp="5" jsaction="mouseenter:jTlRtf; mouseleave:JDTRYd; click:NLMyWb;" jsshadow="" style="-webkit-tap-highlight-color: transparent;"><span jsname="d6wfac" class="CrAOse-hSRGPd CrAOse-hSRGPd-TGB85e-cOuCgd" data-extra-container-classes="EQDr2d gQSlLe WSILo" data-extra-triangle-classes="aTf4cb eN65Ce Txwrvb" data-hover-hide-delay="1000" data-hover-open-delay="500" data-keep-bubble-open-on-hover="" data-theme="0" data-width="235" jsaction="vQLyHf" jsslot="" style="-webkit-tap-highlight-color: transparent; cursor: pointer; pointer-events: none;"><div style="-webkit-tap-highlight-color: transparent;"><svg width="24" height="24" viewBox="0 0 24 24" focusable="false" class="vmWDCc NMm5M"><path d="M9.52 4.1a.55.55 0 01.48-.59h4a.55.55 0 01.48.59V11h-.65L18 15.15V12a1.1 1.1 0 00-1-1h-1V3.53A1.44 1.44 0 0014.53 2H9.47A1.43 1.43 0 008 3.53v1.62l1.51 1.51zM18 18l-7-7-1.49-1.51L8 8 3.51 3.49 2.1 4.91l5.9 5.9V11H7a1.1 1.1 0 00-1 1v7.61a.85.85 0 00.88.83H8v.82a.75.75 0 00.77.74.73.73 0 00.74-.74v-.84h5v.82a.76.76 0 001.51 0v-.82h1.12a.84.84 0 00.41-.11l1.54 1.55 1.42-1.42z"></path><path d="M0 0h24v24H0z" fill="none"></path></svg></div></span></g-bubble></div><div class="YMlIz FpEdX" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 16px; line-height: 20px; font-family: &quot;Google Sans&quot;, Roboto, Arial, sans-serif; letter-spacing: 0.1px; color: rgb(32, 33, 36); text-align: right; white-space: nowrap;"><span data-gs="CjRIVmFkNFk4bDdHT1lBQ1k1VkFCRy0tLS0tLS0tLXlzamcyMUFBQUFBR0JmXy1JRE1qOEFBEgVOSzQ0MxoKCMA+EAIaA1VTRDgccMA+" aria-label="80 US dollars" role="text" style="-webkit-tap-highlight-color: transparent;">$80</span></div></div><div class="N872Rd sSHqwe I11szd POX3ye" style="-webkit-tap-highlight-color: transparent; font-variant-numeric: normal; font-variant-east-asian: normal; font-stretch: normal; font-size: 12px; line-height: 16px; letter-spacing: 0.3px; margin-left: 8px; text-align: right;">round trip</div></div></div></div></div></div></div></div></div>`;

  inputRawHTML.value = flightsExample;
  inputPasteHTML.innerHTML = flightsExample;
  updatePreviewers();
}
//   processRawHTML.addEventListener("click", (event) => {
//     inputRichText.innerHTML = inputRawHTML.value;
//     renderPreviewIframes();
//   });

//   processRichText.addEventListener("click", (event) => {
//     inputRawHTML.value = inputRichText.innerHTML;
//     renderPreviewIframes();
//   });

//   clear.addEventListener("click", (event) => {
//     inputRichText.innerHTML = "";
//     inputRawHTML.value = inputRichText.innerHTML;
//     renderPreviewIframes();
//   });

//   document.querySelector("#diff-tinymce").addEventListener("click", (event) => {
//     showDiff(inputRawHTML.value, tinymceWordPasteFilter(inputRawHTML.value));
//   });

//   document
//     .querySelector("#diff-dompurify")
//     .addEventListener("click", (event) => {
//       showDiff(inputRawHTML.value, dompurify.sanitize(inputRawHTML.value));
//     });

//   document
//     .querySelector("#output-overlay")
//     .addEventListener("change", (event) => {
//       if (event.target.checked) {
//         document
//           .querySelectorAll(".output")
//           .forEach((el) => el.classList.add("output-overlay"));
//         document
//           .querySelectorAll(".output-label")
//           .forEach((el) => el.classList.add("label-overlay"));
//       } else {
//         document
//           .querySelectorAll(".output")
//           .forEach((el) => el.classList.remove("output-overlay"));
//         document
//           .querySelectorAll(".output-label")
//           .forEach((el) => el.classList.remove("label-overlay"));
//       }
//       // console.log(event.target.checked);
//     });

//   const outputBoxes = document.querySelector('#outputboxes');

//   const sanitizerIframes = sanitizers.map( (s) =>
//                                           <div>{s.renderIframe()}</div>
//                                          );
// ReactDOM.render(sanitizerIframes, document.getElementById("outputboxes"));
// ReactDOM.render(<div><Clock /><Clock /></div>, document.getElementById("outputboxes"));

// });
