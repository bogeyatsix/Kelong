var labelType, useGradients, nativeTextSupport, animate;

(function() {
  var ua = navigator.userAgent,
      iStuff = ua.match(/iPhone/i) || ua.match(/iPad/i),
      typeOfCanvas = typeof HTMLCanvasElement,
      nativeCanvasSupport = (typeOfCanvas == 'object' || typeOfCanvas == 'function'),
      textSupport = nativeCanvasSupport 
        && (typeof document.createElement('canvas').getContext('2d').fillText == 'function');
  //I'm setting this based on the fact that ExCanvas provides text support for IE
  //and that as of today iPhone/iPad current text support is lame
  labelType = (!nativeCanvasSupport || (textSupport && !iStuff))? 'Native' : 'HTML';
  nativeTextSupport = labelType == 'Native';
  useGradients = nativeCanvasSupport;
  animate = !(iStuff || !nativeCanvasSupport);

})();

var Log = {
  elem: false,
  write: function(text){
    if (!this.elem) 
      this.elem = document.getElementById('log');
    this.elem.innerHTML = text;
    this.elem.style.left = (500 - this.elem.offsetWidth / 2) + 'px';
  }
};

NODE_WIDTH = 20;
NODE_HEIGHT = 20;
FRAME_HEIGHT = 70;
NODE_RADIUS = 50;
ICONS = {
		maya:null,
		prman:null
	};

for (var name in ICONS) {
	var icon = new Image(),
		iconpath = 'images/'+name+'.png';
	icon.src = iconpath;
	ICONS[name] = icon;
}

function init(json) {

	helpers = {
		config:{
			type:'stacked',
			orientation:'horizontal',
			labelOffset:5,
			barsOffset:1,
			animate:false,
			showAggregates:true,
			showLabels:true,
			Margin: {
		        top: 5,
		        left: 5,
		        right: 5,
		        bottom: 5
			},
			Label: {
				type: 'Native',
				size: 13
			}
		},
		getMaxValue: function(valArray) {
		  	var maxValue = 0, stacked = this.config.type.split(':')[0] == 'stacked';
		    var acum = 0;
		    if(stacked) {
				valArray.forEach(function(v) { 
		        	acum += +v;
		      	});
		    } else {
				acum = Math.max.apply(null, valArray);
		    }
			maxValue = maxValue>acum? maxValue:acum;
			return maxValue;
		},
		normalizeDims: function(valArray) {
		  //number of elements
			var maxValue = this.getMaxValue(valArray) || 1,
				size = {width:100, height:50},
				config = this.config,
				margin = config.Margin,
				marginWidth = margin.left + margin.right,
				marginHeight = margin.top + margin.bottom,
				horz = config.orientation == 'horizontal',
				animate = config.animate,
				l = 1,
//				fixedDim = (size[horz? 'height':'width'] - (horz? marginHeight:marginWidth) - (l -1) * config.barsOffset) / l,
				fixedDim = 100,
				height = 500,
//				height = size[horz? 'width':'height'] - (horz? marginWidth:marginHeight) 
//					- (!horz && config.showAggregates && (config.Label.size + config.labelOffset))
//					- (config.showLabels && (config.Label.size + config.labelOffset)),
				dim1 = horz? 'height':'width',
				dim2 = horz? 'width':'height';
			
			var acum = 0;
			valArray.forEach(function(v) {
				acum += +v;
			});
			n = { acum:acum, dimArray:[], setData:function(k,v) { this[k] = v } };
			n.setData(dim1, fixedDim);
			n.setData(dim2, acum * height / maxValue);
			valArray.forEach(function(v) { 
				var t = v * height / maxValue;
				n.dimArray.push(t)
			});
			return n;

		}
	};

	function barChartPlot(algnPos,ctx) {
		var node = {name:"A"};
		var config = helpers.config;
		var label = config.Label;

		var colorArray = ["#416D9C", "#70A35E", "#EBB056", "#C74243", "#83548B", "#909291", "#557EAA"];
		var colorLength = colorArray.length;
		var stringArray = ['label A'];
		var valueArray = [20, 40, 15, 5];
		var valueLength = valueArray.length;
		var n = helpers.normalizeDims(valueArray);
		var dimArray = n.dimArray;
		var fixedDim = n.height;
		var border = false;
		var horz = true;
		
		var x = algnPos.x, y = algnPos.y;

		if (colorArray && dimArray && stringArray) {

			for (var i=0, l=valueLength, acum=0, valAcum=0; i<l; i++) {
				ctx.fillStyle = ctx.strokeStyle = colorArray[i % colorLength];
				ctx.fillRect(x+acum-200, y-50, dimArray[i], 20);
				acum += (dimArray[i] || 0);
				valAcum += (valueArray[i] || 0);
			}
/*
        if(border) {
          ctx.save();
          ctx.lineWidth = 2;
          ctx.strokeStyle = border.color;
          if(horz) {
            ctx.strokeRect(x + 1, y + opt.acum + 1, opt.dimValue -2, fixedDim - 2);
          } else {
            ctx.strokeRect(x + opt.acum + 1, y - opt.dimValue + 1, fixedDim -2, opt.dimValue -2);
          }
          ctx.restore();
        }

        if(label.type == 'Native') {
          ctx.save();
          ctx.fillStyle = ctx.strokeStyle = label.color;
          ctx.font = label.style + ' ' + label.size + 'px ' + label.family;
          ctx.textBaseline = 'middle';
          var aggValue = true; //aggregates(node.name, valAcum, node);
          if(aggValue !== false) {
            aggValue = aggValue !== true? aggValue : valAcum;
            if(horz) {
              ctx.textAlign = 'right';
              ctx.fillText(aggValue, x + Math.max.apply(null, dimArray) - config.labelOffset, y + height/2);
            } else {
              ctx.textAlign = 'center';
              ctx.fillText(aggValue, x + width/2, y - Math.max.apply(null, dimArray) - label.size/2 - config.labelOffset);
            }
          }
          if(true) { // showLabels(node.name, valAcum, node)
            if(horz) {
              ctx.textAlign = 'center';
              ctx.translate(x - config.labelOffset - label.size/2, y + height/2);
              ctx.rotate(Math.PI / 2);
              ctx.fillText(node.name, 0, 0);
            } else {
              ctx.textAlign = 'center';
              ctx.fillText(node.name, x + width/2, y + label.size/2 + config.labelOffset);
            }
          }
          ctx.restore();
        }
*/      }
	}

    $jit.ST.Plot.NodeTypes.implement({
        //Create a new node type that renders an entire RGraph visualization
        'piechart': {
			render: function(node, canvas, animating) {
				var config = this.config,
					ctx = canvas.getCtx(), 
					pos = node.pos.getc(true),
					radius = node.data.$radius;
				meema = ctx;
	            ctx.save();
	            ctx.translate(pos.x, pos.y);
				
				(function pieChartPlot() {
					var lastend = 0,
						total = node.data.stats.TOTAL,
						angle, stat;
					for (var s in node.data.stats) {
						stat = node.data.stats[s];
						if (s==='TOTAL' || stat.n===0) { continue; };
						angle = Math.PI*2*(stat.n/total);
						
						ctx.fillStyle = stat.color;
						ctx.beginPath();
						ctx.moveTo(0,0);
						ctx.arc(0,0,radius,lastend,lastend+angle,false);
						ctx.lineTo(0,0);
						ctx.fill();
						lastend += angle;
						
						ctx.fillStyle = "#000000";
						ctx.beginPath();
						ctx.moveTo(0,0);
						ctx.arc(0,0,radius/2,lastend,6.3,true);
						ctx.lineTo(0,0);
						ctx.fill();
					}
				})();
				
				(function drawIcon() {
					var rtype = node.data.renderer;
					if (ICONS.hasOwnProperty(rtype)) {
						var icon = ICONS[rtype],
							iconOffsets = {
								left: { x:-120, y:-20 },
								bottom: { x:-25, y:60 }
							},
							orn = config.orientation,
							x = iconOffsets[orn].x,
							y = iconOffsets[orn].y;
						ctx.drawImage(icon, x, y, NODE_RADIUS, NODE_RADIUS);
					};
				})();
				
				ctx.restore();
	          	//width = node.getData('width'),
	          	//height = node.getData('height'),
				//algnPos = this.getAlignedPos(pos, width, height),
				//barChartPlot(algnPos,ctx);
	      	},
			contains: function(node, npos) {
				var pos = node.pos.getc(true),
					radius = node.data.$radius,
					diffx = npos.x - pos.x, 
					diffy = npos.y - pos.y,
					diff = diffx * diffx + diffy * diffy;
				return diff <= radius * radius;
			}
        },
		'fucktangle': {
			render: function(node, canvas) {
				var config = this.config,
					ctx = canvas.getCtx(),
					width = node.getData('width'),
					height = node.getData('height'),
					pos = this.getAlignedPos(node.pos.getc(true), width, height);
				this.nodeHelper.rectangle.render('fill', {x:pos.x+width/2, y:pos.y+height/2}, width, height, canvas);
	            ctx.save();
	            ctx.translate(pos.x, pos.y);
				(function drawThumbnail() {
					if (node.data.hasOwnProperty('thumb')) {
						var icon = node.data.thumb,
							iconOffsets = {
								left: { x:0, y:-10, scale:50 },
								bottom: { x:0, y:-10, scale:50 }
							},
							orn = config.orientation,
							x = iconOffsets[orn].x,
							y = iconOffsets[orn].y;
						try {
						ctx.drawImage(icon, x, y, 80, 45);
						} catch(e) {}
					};
				})();
				ctx.restore();
			},
			contains: function(node, pos) {
				var width = node.getData('width'),
				height = node.getData('height'),
				npos = this.getAlignedPos(node.pos.getc(true), width, height);
				return this.nodeHelper.rectangle.contains({x:npos.x+width/2, y:npos.y+height/2}, pos, width, height);
			}
		}
    });

	//init Spacetree
    //Create a new ST instance

	st = new $jit.ST({

		injectInto: 'infovis',

        duration: 800,

        transition: $jit.Trans.Quart.easeInOut,

        levelDistance: 300,

		siblingOffset: 100,
		
        Navigation: {
			enable:true,
			panning:true,
			zooming:100
        },

        Node: {
			height: NODE_HEIGHT,
			width: NODE_WIDTH,
			type: 'rectangle',
			color: '#aaa',
			overridable: true,
			CanvasStyles: { cursor:'pointer' }
        },
		
        Edge: {
			type: 'bezier',
			alpha:0.1,
			overridable: false
        },
		
		Label: {
			overridable: true,
			type: 'Native',
			style: 'bold',
			size: 10,
			color: "#999999",
			textAlign: 'center',  
		  	textBaseline: 'alphabetic'
		},
		
	    Events: {
			enable: true,
			type: 'Native',
			onClick: function(node, eventInfo, e) {
				if (!node) { return; }
				//console.log(node);
            	if(normal.checked) {
					st.onClick(node.id);
				} else {
                	st.setRoot(node.id, 'animate');
            	}
			},
			onMouseEnter: function(node, eventInfo, e) {
				//st.onClick(node.id);
				//console.log(node);
				//console.log(st.canvas.getElement());
				st.canvas.getElement().style.cursor = 'pointer';
			},
			onMouseLeave: function(node, eventInfo, e) {
				//console.log(st.canvas.getElement());
				st.canvas.getElement().style.cursor = 'default';
			}
		},
		
		//Add tooltips  
	     Tips: {  
			enable: true,
			onShow: function(tip, node) {
				var data = node.data;
				var html = '<div class="tip-title">' + node.id + "</div>";
				tip.innerHTML = html;
			},
			onHide: function() {
				//console.log(this.lastTip);
			}
	     },
		
		//withLabels: false,

		onBeforeCompute: function(node) {
			Log.write("loading " + node.name);
		},
        
		onAfterCompute: function(){
			Log.write("done");
		},
       
        //This method is called on DOM label creation.
        //Use this method to add event handlers and styles to
        //your node.

		onCreateLabelBatch: function(label, node){
			//add some styles to the node label
			var style = label.style;
			console.log(style);
			label.id = node.id;
			label.innerHTML = '[]';
			style.color = '#fff';
			style.textAlign = 'center';
			style.fontSize = '0.8em';
			style.width = "20px";
			style.height = "20px";
			style.paddingTop = "10px"; 
			style.cursor = 'pointer';
        },

		onCreateLabelFrame: function(label, node){
			label.id = node.id;
			label.innerHTML = '';
			//set label styles
			var style = label.style;
			style.width = 60 + 'px';
			style.height = 17 + 'px';            
			style.cursor = 'pointer';
			style.color = '#333'
			style.fontSize = '0.8em';
			style.textAlign= 'center';
			style.paddingTop = '22px';
        },
        
		onCreateLabel: function(label, node) {
			if (node.data.nodetype === 'batch') {
				this.onCreateLabelBatch(label,node);
			} else {
				this.onCreateLabelFrame(label,node)
			}
		},
		
		onBeforePlotNodeNormal: function(node){
            //add some color to the nodes in the path between the
            //root node and the selected node.
			var data = node.data;
			data.$type='fucktangle';
			data.$width=80;
			data.$height=FRAME_HEIGHT;
			
			if (data.hasOwnProperty('nodetype') &&
				data.nodetype==='frame' &&
				data.status==='DONE') {
				var thumbnail = new Image(),
					src = 'http://127.0.0.1:5984/testdb/PID/thumb.jpg'
							.replace(/PID/,node.id);
				thumbnail.src = src;
				data.thumb = thumbnail;
			}

			if (node.selected) {
				node.data.$color = "#ff7";
            } else {
				//delete node.data.$color;
				//if the node belongs to the last plotted level
				if(!node.anySubnode("exist")) {
					//count children number
					//var count = 0;
					//node.eachSubnode(function(n) { count++; });
					//assign a node color based on
					//how many children it has
					//node.data.$color = ['#aaa', '#baa', '#caa', '#daa', '#eaa', '#faa'][count];                    
				}
			}
		},
		
		onBeforePlotNodeBatch: function(node) {
			batchNode = node;
			node.data.$textBaseline = 'bottom';
			node.data.name = node.id;
			node.name = node.data.stats.TOTAL;
			node.data.$type = 'piechart';
			node.data.$radius = NODE_RADIUS;   // <================================ PIECHART RADIUS
		},

        //This method is called right before plotting
        //a node. It's useful for changing an individual node
        //style properties before plotting it.
        //The data properties prefixed with a dollar
        //sign will override the global node style properties.
		onBeforePlotNode: function(node) {
			hooha = node;
			if (node.data.nodetype==='batch') {
				this.onBeforePlotNodeBatch(node);
			} else {
				this.onBeforePlotNodeNormal(node);
			}
		},
        
        //This method is called right before plotting
        //an edge. It's useful for changing an individual edge
        //style properties before plotting it.
        //Edge data proprties prefixed with a dollar sign will
        //override the Edge global style properties.
        onBeforePlotLine: function(adj) {
            if (adj.nodeFrom.selected && adj.nodeTo.selected) {
                adj.data.$color = "#eed";
                adj.data.$lineWidth = 0;
            }
            else {
                delete adj.data.$color;
                delete adj.data.$lineWidth;
            }
        }

    });
    //load json data
    st.loadJSON(json);
    //compute node positions and layout
    st.compute();
    //optional: make a translation of the tree
    st.geom.translate(new $jit.Complex(-200, 0), "current");
    //emulate a click on the root node.
    st.onClick(st.root);
    //end

	//Add event handlers to switch spacetree orientation.
    var top = $jit.id('r-top'), 
        left = $jit.id('r-left'), 
        bottom = $jit.id('r-bottom'), 
        right = $jit.id('r-right'),
        normal = $jit.id('s-normal');
        
    function changeHandler() {
        if(this.checked) {
            top.disabled = bottom.disabled = right.disabled = left.disabled = true;
            st.switchPosition(this.value, "animate", {
                onComplete: function(){
                    top.disabled = bottom.disabled = right.disabled = left.disabled = false;
                }
            });
        }
    };
    
    top.onchange = left.onchange = bottom.onchange = right.onchange = changeHandler;
    //end

	return st

}

function decorate(tree) {
	
	var COLORSTAT = {
		OPEN:"#C9B13C",
		RENDERING:"#3C70C9",
		DONE:"#18865A",
		FAILED:"#E91F5F",
		OTHERS:"#CAC5C7"
	};

	function countStats(batch) {
		var stats = {};
			stats.TOTAL = batch.children.length;
		batch.children.forEach(function addStatCount(frame) {
			var stat = 	frame.data.status in COLORSTAT
						? frame.data.status
						: 'OTHERS';
			if (!stats.hasOwnProperty(stat)) {
				stats[stat] = {n:0,color:COLORSTAT[stat]}
			}
			stats[frame.data.status].n+=1;
		});
		return stats;
	}

	$jit.json.each(tree, function(node) {
		var data = node.data;
		if (data.hasOwnProperty('nodetype')) {
			if (data.nodetype==='frame' && 
				node.data.status in COLORSTAT) {
				node.data.$color = COLORSTAT[node.data.status];
			} else if (data.nodetype==='batch') {
				node.data.stats = countStats(node);
			}
		}
	});
	
	return tree;

}

function getNode(root, ids, callbacks, iter) {
	iter = typeof iter==='undefined' ? 0 : iter;
	if (root.children.length>0 && iter!==ids.length) {
		for (var i=root.children.length-1;i>=0;i--) {
			var child = root.children[i];
			if (child.id===ids[iter]) {
				getNode(child,ids,callbacks,iter+1);
			} else if (iter===0 && i===0 &&
						typeof callbacks.onFail!=='undefined') {
				// First iteration and we've not found a match
				callbacks.onFail();
			}
		};
	} else { 
		// Reached a terminal leaf
		callbacks.onFound(root);
	}
}

$(document).ready(function() {

	var st;
	var loaded = false;
	
	now.ready(function() {
		if (!loaded) {
			now.finalGather(function(e,tree) {
				tree = decorate(tree);
				st = init(tree);
				setTimeout(function() { st.refresh(); },2000);
			});
			loaded = true;
		}
	});
	
	now.newBatch =  function(tree) {
		if (typeof st==='undefined') return
		st.addSubtree(decorate(tree),'replot', {
			hideLabels: false,
			onComplete: function() {
				console.log('++ Batch '+node.data.batchID);
			}
		});
	};
	
	now.updateST = function(node) {
		if (typeof st==='undefined') return
		var tree = st.toJSON();
		getNode(tree,[node.data.batchID,node.id],{
			onFound: function(n) {
				for (var k in n) { n[k] = node[k]; }
				st.loadJSON(decorate(tree));
				st.refresh();
			}
		});
	};

});


































