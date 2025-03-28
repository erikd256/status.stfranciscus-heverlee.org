const maxDays = 30;


async function genReportLog(container, key, url) {
  const response = await fetch("logs/" + key + "_report.log");
  let statusLines = "";
  if (response.ok) {
    statusLines = await response.text();
  }

  const normalized = normalizeData(statusLines);
  const statusStream = constructStatusStream(key, url, normalized);
  container.appendChild(statusStream);
}

function constructStatusStream(key, url, uptimeData) {
  let streamContainer = templatize("statusStreamContainerTemplate");
  for (var ii = maxDays - 1; ii >= 0; ii--) {
    let line = constructStatusLine(key, ii, uptimeData[ii]);
    streamContainer.appendChild(line);
  }

  const lastSet = uptimeData[0];
  const color = getColor(lastSet);

  const container = templatize("statusContainerTemplate", {
    title: key,
    url: url,
    color: color,
    status: getStatusText(color),
    upTime: uptimeData.upTime,
  });

  container.appendChild(streamContainer);
  return container;
}

function constructStatusLine(key, relDay, upTimeArray) {
  let date = new Date();
  date.setDate(date.getDate() - relDay);

  return constructStatusSquare(key.replace(/-/g, " "), date, upTimeArray);
}

function getColor(uptimeVal) {
  return uptimeVal == null
    ? "nodata"
    : uptimeVal == 1
    ? "success"
    : uptimeVal < 0.3
    ? "failure"
    : "partial";
}

function constructStatusSquare(key, date, uptimeVal) {
  const color = getColor(uptimeVal);
  let square = templatize("statusSquareTemplate", {
    color: color,
    tooltip: getTooltip(key, date, color),
  });

  const show = () => {
    showTooltip(square, key, date, color);
  };
  square.addEventListener("mouseover", show);
  square.addEventListener("mousedown", show);
  square.addEventListener("mouseout", hideTooltip);
  return square;
}

let cloneId = 0;
function templatize(templateId, parameters) {
  let clone = document.getElementById(templateId).cloneNode(true);
  clone.id = "template_clone_" + cloneId++;
  if (!parameters) {
    return clone;
  }

  applyTemplateSubstitutions(clone, parameters);
  return clone;
}

function applyTemplateSubstitutions(node, parameters) {
  const attributes = node.getAttributeNames();
  for (var ii = 0; ii < attributes.length; ii++) {
    const attr = attributes[ii];
    const attrVal = node.getAttribute(attr);
    node.setAttribute(attr, templatizeString(attrVal, parameters));
  }

  if (node.childElementCount == 0) {
    node.innerText = templatizeString(node.innerText, parameters);
  } else {
    const children = Array.from(node.children);
    children.forEach((n) => {
      applyTemplateSubstitutions(n, parameters);
    });
  }
}

function templatizeString(text, parameters) {
  if (parameters) {
    for (const [key, val] of Object.entries(parameters)) {
      text = text.replaceAll("$" + key, val);
    }
  }
  return text;
}

function getStatusText(color) {
  return color == "nodata"
    ? "Geen testdata beschikbaar"
    : color == "success"
    ? "Werkt zoals het moet"
    : color == "failure"
    ? "Oepsie"
    : color == "partial"
    ? "Soms werkt het, soms niet... Pech!"
    : "Ajajaja, de website is cookies gaan zoeken";
}

function getStatusDescriptiveText(color) {
  return color == "nodata"
    ? "Geen data beschikbaar, geen tests uitgevoerd :)"
    : color == "success"
    ? "Alles perfekt, als je de cookies accepteert ;)"
    : color == "failure"
    ? "Oepsie, ook wij maken fouten, ja?"
    : color == "partial"
    ? "Waarom werkte dit nu 3 Minuten geleden?"
    : "Geen flauw idee wat er gebeurt";
}

function getTooltip(key, date, quartile, color) {
  let statusText = getStatusText(color);
  return `${key} | ${date.toDateString()} : ${quartile} : ${statusText}`;
}

function create(tag, className) {
  let element = document.createElement(tag);
  element.className = className;
  return element;
}

function normalizeData(statusLines) {
  const rows = statusLines.split("\n");
  const dateNormalized = splitRowsByDate(rows);

  let relativeDateMap = {};
  const now = Date.now();
  for (const [key, val] of Object.entries(dateNormalized)) {
    if (key == "upTime") {
      continue;
    }

    const relDays = getRelativeDays(now, new Date(key).getTime());
    relativeDateMap[relDays] = getDayAverage(val);
  }

  relativeDateMap.upTime = dateNormalized.upTime;
  return relativeDateMap;
}

function getDayAverage(val) {
  if (!val || val.length == 0) {
    return null;
  } else {
    return val.reduce((a, v) => a + v) / val.length;
  }
}

function getRelativeDays(date1, date2) {
  return Math.floor(Math.abs((date1 - date2) / (24 * 3600 * 1000)));
}

function splitRowsByDate(rows) {
  let dateValues = {};
  let sum = 0,
    count = 0;
  for (var ii = 0; ii < rows.length; ii++) {
    const row = rows[ii];
    if (!row) {
      continue;
    }

    const [dateTimeStr, resultStr] = row.split(",", 2);
    const dateTime = new Date(Date.parse(dateTimeStr.replace(/-/g, "/") + " GMT"));
    const dateStr = dateTime.toDateString();

    let resultArray = dateValues[dateStr];
    if (!resultArray) {
      resultArray = [];
      dateValues[dateStr] = resultArray;
      if (dateValues.length > maxDays) {
        break;
      }
    }

    let result = 0;
    if (resultStr.trim() == "success") {
      result = 1;
    }
    sum += result;
    count++;

    resultArray.push(result);
  }

  const upTime = count ? ((sum / count) * 100).toFixed(2) + "%" : "-∞%";
  dateValues.upTime = upTime;
  return dateValues;
}

let tooltipTimeout = null;
function showTooltip(element, key, date, color) {
  clearTimeout(tooltipTimeout);
  const toolTipDiv = document.getElementById("tooltip");

  document.getElementById("tooltipDateTime").innerText = date.toDateString();
  document.getElementById("tooltipDescription").innerText =
    getStatusDescriptiveText(color);

  const statusDiv = document.getElementById("tooltipStatus");
  statusDiv.innerText = getStatusText(color);
  statusDiv.className = color;

  toolTipDiv.style.top = element.offsetTop + element.offsetHeight + 10;
  toolTipDiv.style.left =
    element.offsetLeft + element.offsetWidth / 2 - toolTipDiv.offsetWidth / 2;
  toolTipDiv.style.opacity = "1";
}

function hideTooltip() {
  tooltipTimeout = setTimeout(() => {
    const toolTipDiv = document.getElementById("tooltip");
    toolTipDiv.style.opacity = "0";
  }, 1000);
}

async function genAllReports() {
  const response = await fetch("urls.cfg");
  const configText = await response.text();
  const configLines = configText.split("\n");
  for (let ii = 0; ii < configLines.length; ii++) {
    const configLine = configLines[ii];
    const [key, url] = configLine.split("=");
    if (!key || !url) {
      continue;
    }
    await genReportLog(document.getElementById("reports"), key, url);
  }
}

var urlToGetAllOpenBugs = "https://api.github.com/repos/stfranciscusparochieheverlee/stfranciscusheverlee/issues?state=open&labels=downtime";
var urlToGetAllClosedBugs = "https://api.github.com/repos/stfranciscusparochieheverlee/stfranciscusheverlee/issues?state=closed&labels=downtime";

$(document).ready(function () {
  $.getJSON(urlToGetAllOpenBugs, function (allIssues) {
      $("#issuesCounter").append(allIssues.length);
      if(allIssues.length == 0){
        $("#issuesBlock").hide()
      }
      $.each(allIssues, function (i, issue) {
          $(".issuesContainer")
              .append("<h4>#" + issue.number +" - " + issue.title.split("|")[0] + "<span class='badge bg-warning text-dark'>" + issue.title.split("|")[1].replace(" ", "").replace("_","-") + "</span></h4></br>")
              .append("<h5>" + issue.body +"</h5></br><a target='_blank' class='issues-a' href='https://github.com/stfranciscusparochieheverlee/stfranciscusheverlee/issues/"+issue.number+"'>Lees meer ...</a><hr></hr>");
            });
  });
});    
$(document).ready(function () {
  $.getJSON(urlToGetAllClosedBugs, function (allIssues) {
      $("#pastissuesCounter").append(allIssues.length);
      if(allIssues.length == 0){
        $("#pastissuesBlock").hide()
      }
      $.each(allIssues, function (i, issue) {
          $(".pastissuesContainer")
          .append("<h4>#" + issue.number +" - " + issue.title.split("|")[0] + "<span class='badge bg-success text-dark'>" + issue.title.split("|")[1].replace(" ", "").replace("_","-") + "</span></h4></br>")
          .append("<h5>" + issue.body +"</h5></br><a class='issues-a' target='_blank' href='https://github.com/stfranciscusparochieheverlee/stfranciscusheverlee/issues/"+issue.number+"'>Lees meer ...</a><hr></hr>");
      });
  });
});    
