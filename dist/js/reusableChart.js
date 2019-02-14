(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('d3')) :
  typeof define === 'function' && define.amd ? define(['exports', 'd3'], factory) :
  (factory((global.reusableChart = {}),global.d3));
}(this, (function (exports,d3) { 'use strict';

  ////////////////////////////////////////////////////
  // Processing data                                //
  //////////////////////////////////////////////////// 

  // XHR to load data   
  function readData(file, _hierarchyLevels, selection, debugOn, createChart) {
    if (typeof file !== "undefined" && !Array.isArray(file)) {
      // read data from file 
      if (file.endsWith(".json")) {
        // JSON Format
        d3.json(file).then(function (data) {
          if (debugOn) {
            console.log(data);
          }
          var hierarchy = d3.hierarchy(data);
          if (debugOn) {
            console.log("hierarchy: ");console.log(hierarchy);
          }
          createChart(selection, hierarchy);
        });
      } else if (file.endsWith(".csv")) {
        if (typeof _hierarchyLevels === "undefined") {
          // CSV Format 1
          d3.dsv(",", file).then(function (data) {
            if (debugOn) {
              console.log(data);
            }
            var hierarchy = createHierarchy(data);
            if (debugOn) {
              console.log("hierarchy: ");console.log(hierarchy);
            }
            createChart(selection, hierarchy);
          });
        }
      } else {
        console.log("File must end with .json or csv");
      }
    } else {
      // read data from DOM
      if (typeof file === "undefined") {
        // CSV Format 1
        var myData = readDataFromDOM();
        var hierarchy = createHierarchy(myData);
        if (debugOn) {
          console.log("embedded data: ");console.log(hierarchy);
        }
        createChart(selection, hierarchy);
      } else if (Array.isArray(file)) ; else {
        console.log("Data is not specified correctly");
      }
    }
  }

  function readDataFromDOM() {
    var selector = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "aside#data";

    var inputData = d3.select(selector).text();
    var inputData_cleaned = inputData.trim();
    var file = d3.csvParse(inputData_cleaned);
    return file;
  }

  function createHierarchy(data) {
    var root = d3.stratify().id(function (d) {
      return d.name;
    }).parentId(function (d) {
      return d.parent;
    })(data);
    return root;
  }

  // helper to delete extra white spaces 
  // from -> https://stackoverflow.com/questions/18065807/regular-expression-for-removing-whitespaces
  /*
  function removeWhiteSpaces (str) {
    return str.replace(/^\s+|\s+$|\s+(?=\s)/g, "");
  }

  // helper for XHR
  function convertToNumber(d) {
    for (var perm in d) {
      if (Object.prototype.hasOwnProperty.call(d, perm)) {
        d[perm] = +d[perm];
      }
    }  
    return d;
  } 
  */

  ////////////////////////////////////////////////////
  // add visualization specific processing here     //
  //////////////////////////////////////////////////// 

  function myChart(selection, data, options) {
    var config = {};
    config.width = 1400 - options.margin.right - options.margin.left;
    config.height = 800 - options.margin.top - options.margin.bottom;
    config.i = 0; // counter for numerical IDs
    config.tree = undefined;
    config.root = undefined;
    config.svg = undefined;

    config.svg = selection.append("svg").attr("width", config.width + options.margin.right + options.margin.left).attr("height", config.height + options.margin.top + options.margin.bottom).append("g").attr("transform", "translate(" + options.margin.left + "," + options.margin.top + ")");

    createTree(options, config, data);
    createScale(options, config);
    createUpdateFunctions(options, config, data);
    // root.children.forEach(collapse);
    update(config.root, options, config);
  }

  function createTree(options, config, data) {
    config.tree = options.alignLeaves ? d3.cluster() : d3.tree();
    config.tree.size([config.width, config.height]).nodeSize([0, options.linkWidthValue]);
    // config.root = options.dataEmbedded ? config.tree(data) : config.tree(d3.hierarchy(data));
    config.root = config.tree(data);
    if (options.propagate) {
      config.root.sum(function (d) {
        return d[options.propagateField];
      });
    }

    // baroptions.width = options.width *.8;
    config.root.each(function (d) {
      d.name = d.id; //transferring name to a name variable
      d.id = config.i; //Assigning numerical Ids
      config.i++;
    });
    config.root.x0 = config.root.x;
    config.root.y0 = config.root.y;

    if (options.debugOn) {
      console.log("Data:");console.log(data);
      console.log("Tree:");console.log(config.root);
    }
  }

  function createScale(options, config) {
    var nodes = config.root.descendants();
    if (!options.linkStrengthStatic) {
      options.linkStrengthScale.domain(d3.extent(nodes.slice(1), function (d) {
        return +d[options.linkStrengthField];
      })).range(options.linkStrengthRange);
    }
    if (!options.linkWidthStatic) {
      options.linkWidthScale.domain(d3.extent(nodes.slice(1), function (d) {
        return +d[options.linkWidthField];
      })).range(options.linkWidthRange);
    }
  }

  function createUpdateFunctions(options, config, data) {
    options.updateLinkWidth = function () {
      if (options.linkWidthStatic) {
        config.tree.nodeSize([0, options.linkWidthValue]);
      } else {
        createScale(options, config);
      }
      update(config.root, options, config);
    };

    options.updateLinkHeight = function () {
      update(config.root, options, config);
    };

    options.updateLinkStrength = function () {
      createScale(options, config);
      update(config.root, options, config);
    };

    options.updateAlignLeaves = function () {
      createTree(options, config, data);
      update(config.root, options, config);
    };
  }

  function linkPath(d, linkFunction) {
    var path = linkFunction === "curved" ? // curved
    "M" + d.y + "," + d.x + "C" + (d.y + d.parent.y) / 2 + "," + d.x + " " + (d.y + d.parent.y) / 2 + "," + d.parent.x + " " + d.parent.y + "," + d.parent.x : // straight
    "M" + d.parent.y + "," + d.parent.x + "V" + d.x + "H" + d.y;
    return path;
  }

  /*
  function collapse(d){
    if (d.children) {
      d._children = d.children;
      d._children.forEach(collapse);
      d.children = null;
    }
  }
  */

  function click(d, options, config) {
    if (d.children) {
      d._children = d.children;
      d.children = null;
    } else {
      d.children = d._children;
      d._children = null;
    }
    update(d, options, config);
  }

  function update(source, options, config) {
    config.width = 800;

    // Compute the new tree layout.
    var nodes = config.tree(config.root);
    var nodesSort = [];
    nodes.eachBefore(function (n) {
      nodesSort.push(n);
    });
    config.height = Math.max(500, nodesSort.length * options.linkHeight + options.margin.top + options.margin.bottom);
    var links = nodesSort.slice(1);
    // Compute the "layout".
    nodesSort.forEach(function (n, i) {
      n.x = i * options.linkHeight;
      if (!options.linkWidthStatic) {
        if (i !== 0) {
          n.y = n.parent.y + options.linkWidthScale(n[options.linkWidthField]);
        }
      }
    });

    d3.select("svg").transition().duration(options.transitionDuration).attr("height", config.height);

    // Update the nodes…
    var node = config.svg.selectAll("g.node").data(nodesSort, function (d) {
      return d.id || (d.id = ++config.i);
    });

    // Enter any new nodes at the parent's previous position.
    var nodeEnter = node.enter().append("g").attr("class", "node").attr("transform", function () {
      return "translate(" + source.y0 + "," + source.x0 + ")";
    }).on("click", function (d) {
      return click(d, options, config);
    });

    nodeEnter.append("circle").attr("r", 1e-6).style("fill", function (d) {
      return d._children ? "lightsteelblue" : "#fff";
    });

    nodeEnter.append("text").attr("x", 10).attr("dy", ".35em").attr("text-anchor", "start")
    // .attr("x", 0)
    // .attr("y", -12)
    // .attr("dy", ".35em")
    // .attr("text-anchor", "middle") 
    .text(function (d) {
      if (d.data.name.length > options.maxNameLength) {
        return d.data.name.substring(0, options.maxNameLength) + "...";
      } else {
        return d.data.name;
      }
    }).style("fill-opacity", 1e-6);

    nodeEnter.append("svg:title").text(function (d) {
      return d.data.name;
    });

    // Transition nodes to their new position.
    var nodeUpdate = node.merge(nodeEnter).transition().duration(options.transitionDuration);

    nodeUpdate.attr("transform", function (d) {
      return "translate(" + d.y + "," + d.x + ")";
    });

    nodeUpdate.select("circle").attr("r", 4.5).style("fill", function (d) {
      return d._children ? "lightsteelblue" : "#fff";
    });

    nodeUpdate.select("text").style("fill-opacity", 1);

    // Transition exiting nodes to the parent's new position (and remove the nodes)
    var nodeExit = node.exit().transition().duration(options.transitionDuration);

    nodeExit.attr("transform", function () {
      return "translate(" + source.y + "," + source.x + ")";
    }).remove();

    nodeExit.select("circle").attr("r", 1e-6);

    nodeExit.select("text").style("fill-opacity", 1e-6);

    // Update the links…
    var link = config.svg.selectAll("path.link").data(links, function (d) {
      // return d.target.id;
      var id = d.id + "->" + d.parent.id;
      return id;
    });

    // Enter any new links at the parent's previous position.
    var linkEnter = link.enter().insert("path", "g").attr("class", "link").attr("d", function () {
      var o = { x: source.x0, y: source.y0, parent: { x: source.x0, y: source.y0 } };
      return linkPath(o, options.linkFunction);
    });

    // Transition links to their new position.
    link.merge(linkEnter).transition().duration(options.transitionDuration).attr("d", function (d) {
      return linkPath(d, options.linkFunction);
    })
    // .style("stroke-width", options.linkStrength) 
    .style("stroke-width", function (d) {
      return options.linkStrengthStatic ? options.linkStrengthValue + "px" : options.linkStrengthScale(d.value) + "px";
    });

    // // Transition exiting nodes to the parent's new position.
    link.exit().transition().duration(options.transitionDuration).attr("d", function () {
      var o = { x: source.x, y: source.y, parent: { x: source.x, y: source.y } };
      return linkPath(o, options.linkFunction);
    }).remove();

    // Stash the old positions for transition.
    nodesSort.forEach(function (d) {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }

  function d3_template_reusable (_myData) {
    var _hierarchyLevels = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : undefined;

    ///////////////////////////////////////////////////
    // 1.0 ADD visualization specific variables here //
    ///////////////////////////////////////////////////
    var options = {};
    // 1. ADD all options that should be accessible to caller
    options.debugOn = false;
    options.dataEmbedded = typeof _myData !== "undefined" ? false : true;
    options.margin = { top: 20, right: 10, bottom: 20, left: 10 };
    options.maxNameLength = 50;
    options.transitionDuration = 750;

    options.linkFunction = "straight"; // alternative is "curved"
    options.linkHeight = 20;
    /*
    options.linkWidth = 30;
    options.linkWidthScale = d3.scaleLinear().domain([264, 432629]).range([15,100]);
    options.linkWidthField = "value";
    */
    // true if linkWidth is a fixed number, otherwise dynamically calculated from options.linkWidthField
    options.linkWidthStatic = true;
    options.linkWidthValue = 30;
    options.linkWidthScale = d3.scaleLinear();
    options.linkWidthField = "value";
    options.linkWidthRange = [15, 100];

    // true if linkStrength is a fixed number, otherwise dynamically calculated from options.linkStrengthField
    options.linkStrengthStatic = true;
    options.linkStrengthValue = 1;
    options.linkStrengthScale = d3.scaleLinear();
    options.linkStrengthField = "value";
    options.linkStrengthRange = [1, 10];

    options.propagate = false; // default: no propagation
    options.propagateField = "value"; // default field for propagation

    options.alignLeaves = false; // use tree layout as default, otherwise cluster layout

    // 2. ADD getter-setter methods here
    chartAPI.debugOn = function (_) {
      if (!arguments.length) return options.debugOn;
      options.debugOn = _;
      return chartAPI;
    };

    chartAPI.margin = function (_) {
      if (!arguments.length) return options.margin;
      options.margin = _;
      return chartAPI;
    };

    chartAPI.maxNameLength = function (_) {
      if (!arguments.length) return options.maxNameLength;
      options.maxNameLength = _;
      return chartAPI;
    };

    chartAPI.transitionDuration = function (_) {
      if (!arguments.length) return options.transitionDuration;
      options.transitionDuration = _;
      return chartAPI;
    };

    chartAPI.linkFunction = function (_) {
      if (!arguments.length) return options.linkFunction;
      options.linkFunction = _;
      return chartAPI;
    };

    chartAPI.propagateValue = function (_) {
      if (!arguments.length) return options.propagate + ": " + options.propagateField;
      options.propagate = true;
      options.propagateField = _;
      return chartAPI;
    };

    // 3. ADD getter-setter methods with updateable functions here
    chartAPI.linkHeight = function (_) {
      if (!arguments.length) return options.linkHeight;
      options.linkHeight = _;
      if (typeof options.updateLinkHeight === "function") options.updateLinkHeight();
      return chartAPI;
    };

    chartAPI.linkWidth = function (_) {
      var scale = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : options.linkWidthScale;
      var range = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : options.linkWidthRange;

      if (!arguments.length) return options.linkWidthValue + ", scale: " + options.linkWidthScale;
      if (typeof _ === "number") {
        options.linkWidthStatic = true;
        options.linkWidthValue = _;
      } else if (typeof _ === "string") {
        options.linkWidthStatic = false;
        options.linkWidthField = _;
        options.linkWidthScale = scale;
        options.linkWidthRange = range;
      }

      if (typeof options.updateLinkWidth === "function") options.updateLinkWidth();
      return chartAPI;
    };

    chartAPI.linkStrength = function (_) {
      var scale = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : options.linkStrengthScale;
      var range = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : options.linkStrengthRange;

      if (!arguments.length) return options.linkStrengthValue + ", scale: " + options.linkStrengthScale;
      if (typeof _ === "number") {
        options.linkStrengthStatic = true;
        options.linkStrengthValue = _;
      } else if (typeof _ === "string") {
        options.linkStrengthStatic = false;
        options.linkStrengthField = _;
        options.linkStrengthScale = scale;
        options.linkStrengthRange = range;
      }

      if (typeof options.updateLinkStrength === "function") options.updateLinkStrength();
      return chartAPI;
    };

    chartAPI.alignLeaves = function (_) {
      if (!arguments.length) return options.alignLeaves;
      options.alignLeaves = _;
      if (typeof options.updateAlignLeaves === "function") options.updateAlignLeaves();
      return chartAPI;
    };

    ////////////////////////////////////////////////////
    // API for external access                        //
    //////////////////////////////////////////////////// 

    // standard API for selection.call()
    function chartAPI(selection) {
      selection.each(function (d) {
        console.log(d);
        console.log("_myData " + _myData);
        if (typeof d !== "undefined") {
          // data processing from outside
          createChart(selection, d);
        } else {
          // data processing here
          readData(_myData, _hierarchyLevels, selection, options.debugOn, createChart);
        }
      });
    }

    // call visualization entry function
    function createChart(selection, data) {
      myChart(selection, data, options);
    }

    return chartAPI;
  }

  exports.chart = d3_template_reusable;

  Object.defineProperty(exports, '__esModule', { value: true });

})));
