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

// Global Constants -------------------------

var KEYCODES = {
		up:38,
		down:40,
		left:37,
		right:39,
		enter:13,
		ctrl:17,
		alt:18,
		cmd:91
	},

	COLORSTAT = {
		OPEN:"#C9B13C",
		RENDERING:"#3C70C9",
		DONE:"#18865A",
		FAILED:"#E91F5F",
		OTHERS:"#CAC5C7"
	},

	NODE_WIDTH = 20,
	NODE_HEIGHT = 20,
	
	FRAME_HEIGHT = 70,
	FRAME_WIDTH = 80,
	
	NODE_RADIUS = 50,
	
	ICONS = { maya:null, prman:null },
	
	THUMBNAILS = {};

// --------------------------------------------

for (var name in ICONS) {
	var icon = new Image();
	icon.src = 'images/'+name+'.png';
	ICONS[name] = icon;
}

function init(json) {

	$jit.ST.Plot.NodeTypes.implement({
		'piechart': {
			render: function(node, canvas, animating) {
				var config = this.config,
					ctx = canvas.getCtx(),
					pos = node.pos.getc(true),
					data = node.data,
					stats = data.stats,
					radius = data.$radius;
				ctx.save();
				ctx.translate(pos.x, pos.y);
				
				(function drawPieChart() {
					var lastend = 0,
						total = stats.TOTAL,
						angle, stat;
					for (var s in stats) {
						stat = stats[s];
						if (s==='TOTAL' || stat.n===0) { continue; }
						angle = Math.PI*2*(stat.n/total);
						
						ctx.fillStyle = stat.color;
						ctx.beginPath();
						ctx.moveTo(0,0);
						ctx.arc(0,0,radius,lastend,lastend+angle,false);
						ctx.lineTo(0,0);
						ctx.fill();
						lastend += angle;
						
						// The dark chocolaty center
						ctx.fillStyle = node.selected ? '#FFF263' : '#000000';
						ctx.beginPath();
						//ctx.moveTo(0,0);
						ctx.arc(0,0,radius/2,0,Math.PI*2,true);
						//ctx.lineTo(0,0);
						ctx.fill();
					}
				})();
				
				(function drawRendererIcon() {
					var rtype = data.renderer;
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
					}
				})();
				
				(function drawTotalFrames() {
					ctx.font = "bold 20px sans-serif";
					ctx.textAlign = 'center';
					ctx.textBaseline = 'alphabetic';
					ctx.fillStyle = "#B1B1B1";
					ctx.fillText(stats.TOTAL, 0, 5);
				})();

				ctx.restore();
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
					if (node.data.hasOwnProperty('thumbnail')) {
						var icon = node.data.thumbnail,
							iconOffsets = {
								left: { x:0, y:-10},
								bottom: { x:0, y:-10}
							},
							orn = config.orientation,
							x = iconOffsets[orn].x,
							y = iconOffsets[orn].y;
						try {
							ctx.drawImage(icon, x, y, 80, 45);
						} catch(e) { /* 404 Image not Found pass... */ }
					}
				})();
				
				(function drawFrameNumber() {
					ctx.font = "bold 12px sans-serif";
					ctx.textAlign = 'center';
					ctx.textBaseline = 'alphabetic';
					ctx.fillStyle = "#B1B1B1";
					ctx.fillText(node.name, 40, 50);
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

        duration: 600,

		fps: 25,

        transition: $jit.Trans.Quart.easeInOut,

        levelDistance: 1000,

		siblingOffset: FRAME_HEIGHT+20,

		withLabels: false,

        Navigation: {
			enable:true,
			panning:true,
			zooming:100
        },

        Node: {
			overridable: true,
			height: NODE_HEIGHT,
			width: NODE_WIDTH,
			type: 'rectangle',
			color: '#aaa',
			CanvasStyles: { cursor:'pointer' }
		},
		
        Edge: {
			overridable: true,
			type: 'line',
			color:'#474C4D',
			alpha:1
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
				if(normal.checked) {
					st.onClick(node.id);
				} else {
                	st.setRoot(node.id, 'animate');
            	}
			},
			onMouseEnter: function(node, eventInfo, e) {
				if (!node) { return; }
				st.canvas.getElement().style.cursor = 'pointer';
			},
			onMouseLeave: function(node, eventInfo, e) {
				if (!node) { return; }
				st.canvas.getElement().style.cursor = 'default';
			}
		},
		
		Tips: {  
			enable: true,
			onShow: function(tip, node) {
				var data = node.data;
				var html = '<div class="tip-title">' + node.id + "</div>";
				tip.innerHTML = html;
			}
		},
		
		onBeforeCompute: function(node) {
			Log.write("loading " + node.name);
		},
        
		onAfterCompute: function() {
			Log.write("done");
		},
       
		onBeforePlotNodeFrame: function(node) { // <================================ FRAME NODES
			var data = node.data, thumbnail, src;
			data.$type='fucktangle';
			data.$width=FRAME_WIDTH;
			data.$height=FRAME_HEIGHT;
			if (data.status==='DONE') {
				thumbnail = new Image();
				src = 'http://127.0.0.1:5984/maggiequeue/NODE_ID/thumb.jpg'
						.replace(/NODE_ID/,node.id);
				thumbnail.src = src;
				node.data.thumbnail = thumbnail;
			}
		},
		
		onBeforePlotNodeBatch: function(node) { // <================================ BATCH NODES
			batchNode = node;
			node.data.$textBaseline = 'bottom';
			node.data.$type = 'piechart';
			node.data.$radius = NODE_RADIUS;   
		},
		
		onBeforePlotNode: function(node) { // <================================ ENTRY POINT
			if (node.data.hasOwnProperty('nodetype')) {
				if (node.data.nodetype==='batch') {
					this.onBeforePlotNodeBatch(node);
				} else if (node.data.nodetype==='frame') {
					this.onBeforePlotNodeFrame(node);
				}
			}
		},
        
		onBeforePlotLine: function(adj) {
			var nodeToData = adj.nodeTo.data;
			if (nodeToData.hasOwnProperty('nodetype') &&
				nodeToData.nodetype==='frame' &&
				nodeToData.status==='RENDERING') {
					adj.data.$color = "#17A9B6";
					adj.data.$lineWidth = 7;
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
    }
    
    top.onchange = left.onchange = bottom.onchange = right.onchange = changeHandler;
    //end

	return st

}

SEARCH_NODES = [];

function decorate(tree) {
	$jit.json.each(tree, function(node) {
		SEARCH_NODES.push({id:node.id,text:node.id});
	});
	return tree;
}

function getNode(root, ids, callbacks, iter) {
	var child;
	iter = typeof iter==='undefined' ? 0 : iter;
	if (root.children.length>0 && iter!==ids.length) {
		for (var i=root.children.length-1;i>=0;i--) {
			child = root.children[i];
			if (child.id===ids[iter]) {
				getNode(child, ids, callbacks, iter+1);
			} else 
			if (iter===0 && i===0 &&
				typeof callbacks.onFail!=='undefined') {
				// First iteration and we've not found a match
				callbacks.onFail();
			}
		}
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
			now.finalGather(null, function(tree) {
				st = init(decorate(tree));
				setTimeout(function() { st.refresh(); },2000);
			});
			loaded = true;
		}
	});
	
	now.newBatch =  function(tree) {
		if (typeof st==='undefined') return;
		st.addSubtree(decorate(tree),'replot', {
			hideLabels: false,
			onComplete: function() {
				console.log('++ Batch '+node.data.batchID);
			}
		});
	};
	
	now.updateST = function(node) {
		if (typeof st==='undefined') return;
		var tree = st.toJSON();
		getNode(tree,[node.data.batchID,node.id],{
			onFound: function(n) {
				for (var k in n) { n[k] = node[k]; }
				st.loadJSON(tree);
				st.refresh();
			}
		},0);
	};

	var $projectBox = $('input#projectBox'),
		pjbox_original_val = $projectBox.val();
	$projectBox.focus(function() {
		$(this).val()===pjbox_original_val && $(this).val('');
	})
	.blur(function() {
		$(this).val()==='' && $(this).val(pjbox_original_val);
	})
	.keydown(function(event) {
		var projectID;
		if (event.which===KEYCODES.enter) {
			projectID = $projectBox.val();
		}
	});
	
	var $searchBox = $('input#suggestBox'),
		search_original_val = $searchBox.val();
	$searchBox.focus(function() {
		$(this).val()===search_original_val && $(this).val('');
	})
	.blur(function() {
		$(this).val()==='' && $(this).val(search_original_val);
	})
	.jsonSuggest(SEARCH_NODES, {onSelect:function(item) {
			$searchBox.val(search_original_val);
			st.onClick(item.id);
		}
	});

});


































