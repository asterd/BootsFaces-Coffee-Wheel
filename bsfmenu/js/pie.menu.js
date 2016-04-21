(function ($, window, document) {
   'use strict';


   // Main function
   $.fn.pieMenu = function (options) {
      // settings
      var o = $.fn.pieMenu.settings = $.extend({}, $.fn.pieMenu.defaults, options)

      // global variables
      var _root;
      var _currentNodeList;

      // determine size
      var width = $('#' + o.containerID).width();
      var height = $('#' + o.containerID).height();

      // get max square size
      if(width >= height) {
         width = height / 1.1;
         height = width;
      } else {
         width = width / 1.1;
         height = width;
      }

      // set sizes
      var radius = width / 2,
          arcInner = radius / 2,
          arcOuter = radius - 4;

      var arc = d3.svg.arc()
          .outerRadius(arcOuter)
          .innerRadius(arcInner);
      var arcShadow = d3.svg.arc()
          .outerRadius(arcInner + 1)
          .innerRadius(arcInner - 15);

      // read json data
      d3.json(o.jsonUrl, function(error, root) {
         if(_currentNodeList != undefined) updateData(_currentNodeList);
         else {
            _root = root;
            _currentNodeList = _root;
            updatePieData(_root);
         }
      });

      // internal functions
      function updatePieData(root) {
         // empty container
         $('#' + o.containerID).empty();

         // define pie
         var pie = d3.layout.pie()
             .sort(null)
             .value(function(d) {
                 if(d.children)
                     return d.children.length;
                 else return 2;
             });

         // define main svg
         var svg = d3.select('#' + o.containerID)
             .append("svg")
             .attr( { width: width, height: height, class: o.render3D ? 'shadow':''})
             .append("g")
             .attr("id", "pieChart")
             .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");

         // append defs for logo url
         if(o.logoUrl != '') {
            svg.append("defs")
               .append('pattern')
               .attr( {
                               id: 'bsflogo',
                                x: radius / 2.4,
                                y: radius / 2.4,
                     patternUnits: 'userSpaceOnUse',
                            width: radius / 1.2,
                           height: radius / 1.2
               })
               .append("image")
               .attr("xlink:href", o.logoUrl)
               .attr( {
                               x: 0,
                               y: 0,
                           width: radius / 1.2,
                          height: radius / 1.2
               });
         }

         // render data
         var dataToRender;
         if(root.children != undefined) dataToRender = root.children;
         else dataToRender = root;

         var piedata = pie(dataToRender);

         // base path
         var path = svg.selectAll("path1")
             .data(piedata)
             .enter()
             .append("path")
             .attr("class", "path1")
             .on("click", click)
             .on("mouseleave", mouseleave)
             .on("mouseover", mouseover)
             .on("touchstart", mouseover)
             .on("touchend", mouseleave);

         path.transition()
             .duration(500)
             .attr("fill", function(d, i) {
                 return d.data.colour;
             })
             .transition().duration(500)
             .attrTween('d', tweenPie);

         // 3d path
         if(o.render3D) {
            var pathShadow = svg.selectAll("path2")
                       .data(piedata)
                       .enter()
                       .append("path")
                       .attr({
                           class: "path2",
                           d: arcShadow,
                           fill: function(d, i) {
                               var c = d3.hsl(d.data.colour);
                               return d3.hsl((c.h+5), (c.s -.07), (c.l -.15));
                           }
                       });

            pathShadow.transition()
                       .duration(1000)
                       .attrTween('d', function(d) {
                           var interpolate = d3.interpolate({startAngle: 0, endAngle: 0}, d);
                           return function(t) {
                               return arcShadow(interpolate(t));
                           };
                       });
         }

         // Add rotated text
         var text = svg.selectAll("text")
            .data(piedata)
            .enter()
            .append("svg:text")
            .attr("dy", ".35em")
            .attr("text-anchor", "middle")
            .attr("fill", function(d) { return d3plus.color.text(d.data.colour); })
            .style("font-size", "12px")
            .text(function(d) { return d.data.name; })
            .on("click", click)
            .on("mouseleave", mouseleave)
            .on("mouseover", mouseover);

         text.transition()
             .duration(1200)
             .style("fill-opacity", function(e) { return 1 })
             .attr("transform", function(d) {
               d.outerRadius = radius; // Set Outer Coordinate
               d.innerRadius = radius / 2; // Set Inner Coordinate
               return "translate(" + arc.centroid(d) + ")rotate(" + angle(d) + ")";
            });

         // append center logo
         svg.append("circle")
            .attr("class", "logo")
            .attr("id", "item-logo")
            .attr("cx", 0)
            .attr("cy", 0)
            .attr("r", radius / 2.5)
            .attr("fill", "url(#bsflogo) white")
            .on("click", function() {
               if(_currentNodeList.name != undefined) {
                  var parent = findParent(_root, _currentNodeList.name);
                  if(parent != undefined) {
                     _currentNodeList = parent;
                     updatePieData(parent);
                  }
               }
            });
         addCenterText("");

         // Function to add a center text
         function addCenterText(text) {
              if($('#info-text').length > 0) {
                 d3.select("#info-text").text(text);
              } else {
                 svg.append('text')
                    .text(text)
                    .attr({
                        'text-anchor' : 'middle',
                                   id : 'info-text'
                    })
                    .style({
                        fill : '#666'
                    });
              }

              // Wrap text in a circle, and size the text to fit.
              if(text != "") {
                 $('#bsflogo').hide();
                 $('#info-text').show();

                 d3plus.textwrap()
                   .container(d3.select("#info-text"))
                   .resize(true)
                   .padding(5)
                   .align("middle")
                   .valign("middle")
                   .draw();

              } else {
                 $('#info-text').hide();
              }
         };

         // hide the center text
         function hideCenterText() {
            $('#info-text').hide();
            $('#bsflogo').show();
         };

         // Fade all but the current sequence, and show it in the breadcrumb trail.
         function mouseover(d) {
            d3.event.stopPropagation();
            // Then highlight only those that are an ancestor of the current segment.
            svg.selectAll(".path1")
               .filter(function(node) { return node.data.name === d.data.name; })
               .attr("fill", function(node) { return d3plus.color.lighter(node.data.colour, -0.4); });

            addCenterText(d.data.name);
         };

         // Restore everything to full opacity when moving off the visualization.
         function mouseleave(d) {
            d3.event.stopPropagation();
            d3.selectAll(".path1")
              .attr("fill", function(node) { return node.data.colour; });
            hideCenterText();
         };

         // click on leaf node
         function click(d) {
            if(d.data.children != undefined) {
               _currentNodeList = d.data;
               updatePieData(_currentNodeList);
            } else {
               window.location.href = d.data.href;
            }
         };
      };

      // Computes the angle of an arc, converting from radians to degrees.
      function angle(d) {
         var a = (d.startAngle + d.endAngle) * 90 / Math.PI - 90;
         return a > 90 ? a - 180 : a;
      };

      // Find node parent
      function findParent(rootNode, currentName) {
         var itemToCycle;

         // set the correct type for search
         if($.isArray(rootNode)) itemToCycle = rootNode;
         else if(rootNode.children != undefined) itemToCycle = rootNode.children;
         else return;

         // cycle
         for (var index = 0; index < itemToCycle.length; index++) {
            if(itemToCycle[index].name === currentName) {
               return rootNode;
            } else if(itemToCycle[index].children != undefined) {
               var parent = findParent(itemToCycle[index], currentName);
               if(parent != undefined) return parent;
            }
         }
      };

      // Tween animation for pie
      function tweenPie(finish) {
           var start = {
                   startAngle: 0,
                   endAngle: 0
               };
           var i = d3.interpolate(start, finish);
           return function(d) { return arc(i(d)); };
      };
   };


   // Defaults
   $.fn.pieMenu.defaults = {
      containerID: 'vis',      // ID of the item container
      render3D: false,         // Set if the menu needs to render in 'fake' 3D mode
      jsonUrl: '',             // Url of the json source of the component
      logoUrl: '',             // Url of the center logo
   };

   $.pieMenu = $.fn.pieMenu;
})(jQuery, window, document);
