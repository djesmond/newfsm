
import { TextElement } from "./text_element"
import { drawText, drawArrow } from "../main/draw"
import { nodeRadius, snapToPadding, hitTargetPadding } from "../constants"
import { circleFromThreePoints } from "../main/math"

export class Link extends TextElement {
	constructor(a, b) {
		super();
		this.nodeA = a;
		this.nodeB = b;
		this.lineAngleAdjust = 0; // value to add to textAngle when link is straight line

		// make anchor point relative to the locations of nodeA and nodeB
		this.parallelPart = 0.5; // percentage from nodeA to nodeB
		this.perpendicularPart = 0; // pixels from line between nodeA and nodeB
	}

	getLabelPosition() {
		return this.getAnchorPoint();
	}

	getAnchorPoint() {
		var dx = this.nodeB.x - this.nodeA.x;
		var dy = this.nodeB.y - this.nodeA.y;
		var scale = Math.sqrt(dx * dx + dy * dy);
		return {
			'x': this.nodeA.x + dx * this.parallelPart - dy * this.perpendicularPart / scale,
			'y': this.nodeA.y + dy * this.parallelPart + dx * this.perpendicularPart / scale
		};
	}

	setAnchorPoint(x, y) {
		var dx = this.nodeB.x - this.nodeA.x;
		var dy = this.nodeB.y - this.nodeA.y;
		var scale = Math.sqrt(dx * dx + dy * dy);
		this.parallelPart = (dx * (x - this.nodeA.x) + dy * (y - this.nodeA.y)) / (scale * scale);
		this.perpendicularPart = (dx * (y - this.nodeA.y) - dy * (x - this.nodeA.x)) / scale;
		// snap to a straight line
		if(this.parallelPart > 0 && this.parallelPart < 1 && Math.abs(this.perpendicularPart) < snapToPadding) {
			this.lineAngleAdjust = (this.perpendicularPart < 0) * Math.PI;
			this.perpendicularPart = 0;
		}
	}

	getEndPointsAndCircle() {
		if(this.perpendicularPart == 0) {
			var midX = (this.nodeA.x + this.nodeB.x) / 2;
			var midY = (this.nodeA.y + this.nodeB.y) / 2;
			var start = this.nodeA.closestPointOnCircle(midX, midY);
			var end = this.nodeB.closestPointOnCircle(midX, midY);
			return {
				'hasCircle': false,
				'startX': start.x,
				'startY': start.y,
				'endX': end.x,
				'endY': end.y,
			};
		}
		var anchor = this.getAnchorPoint();
		var circle = circleFromThreePoints(this.nodeA.x, this.nodeA.y, this.nodeB.x, this.nodeB.y, anchor.x, anchor.y);
		var isReversed = (this.perpendicularPart > 0);
		var reverseScale = isReversed ? 1 : -1;
		var startAngle = Math.atan2(this.nodeA.y - circle.y, this.nodeA.x - circle.x) - reverseScale * nodeRadius / circle.radius;
		var endAngle = Math.atan2(this.nodeB.y - circle.y, this.nodeB.x - circle.x) + reverseScale * nodeRadius / circle.radius;
		var startX = circle.x + circle.radius * Math.cos(startAngle);
		var startY = circle.y + circle.radius * Math.sin(startAngle);
		var endX = circle.x + circle.radius * Math.cos(endAngle);
		var endY = circle.y + circle.radius * Math.sin(endAngle);
		return {
			'hasCircle': true,
			'startX': startX,
			'startY': startY,
			'endX': endX,
			'endY': endY,
			'startAngle': startAngle,
			'endAngle': endAngle,
			'circleX': circle.x,
			'circleY': circle.y,
			'circleRadius': circle.radius,
			'reverseScale': reverseScale,
			'isReversed': isReversed,
		};
	}

	draw(c) {
		var stuff = this.getEndPointsAndCircle();
		// draw arc
		c.beginPath();
		if(stuff.hasCircle) {
			c.arc(stuff.circleX, stuff.circleY, stuff.circleRadius, stuff.startAngle, stuff.endAngle, stuff.isReversed);
		} else {
			c.moveTo(stuff.startX, stuff.startY);
			c.lineTo(stuff.endX, stuff.endY);
		}
		c.stroke();
		// draw the head of the arrow
		if(stuff.hasCircle) {
			drawArrow(c, stuff.endX, stuff.endY, stuff.endAngle - stuff.reverseScale * (Math.PI / 2));
		} else {
			drawArrow(c, stuff.endX, stuff.endY, Math.atan2(stuff.endY - stuff.startY, stuff.endX - stuff.startX));
		}
		// draw the text
		if(stuff.hasCircle) {
			var startAngle = stuff.startAngle;
			var endAngle = stuff.endAngle;
			if(endAngle < startAngle) {
				endAngle += Math.PI * 2;
			}
			var textAngle = (startAngle + endAngle) / 2 + stuff.isReversed * Math.PI;
			var textX = stuff.circleX + stuff.circleRadius * Math.cos(textAngle);
			var textY = stuff.circleY + stuff.circleRadius * Math.sin(textAngle);
			drawText(c, this.text, textX, textY, textAngle);
		} else {
			var textX = (stuff.startX + stuff.endX) / 2;
			var textY = (stuff.startY + stuff.endY) / 2;
			var textAngle = Math.atan2(stuff.endX - stuff.startX, stuff.startY - stuff.endY);
			drawText(c, this.text, textX, textY, textAngle + this.lineAngleAdjust);
		}
	}

	containsPoint(x, y) {
		var stuff = this.getEndPointsAndCircle();
		if(stuff.hasCircle) {
			var dx = x - stuff.circleX;
			var dy = y - stuff.circleY;
			var distance = Math.sqrt(dx*dx + dy*dy) - stuff.circleRadius;
			if(Math.abs(distance) < hitTargetPadding) {
				var angle = Math.atan2(dy, dx);
				var startAngle = stuff.startAngle;
				var endAngle = stuff.endAngle;
				if(stuff.isReversed) {
					var temp = startAngle;
					startAngle = endAngle;
					endAngle = temp;
				}
				if(endAngle < startAngle) {
					endAngle += Math.PI * 2;
				}
				if(angle < startAngle) {
					angle += Math.PI * 2;
				} else if(angle > endAngle) {
					angle -= Math.PI * 2;
				}
				return (angle > startAngle && angle < endAngle);
			}
		} else {
			var dx = stuff.endX - stuff.startX;
			var dy = stuff.endY - stuff.startY;
			var length = Math.sqrt(dx*dx + dy*dy);
			var percent = (dx * (x - stuff.startX) + dy * (y - stuff.startY)) / (length * length);
			var distance = (dx * (y - stuff.startY) - dy * (x - stuff.startX)) / length;
			return (percent > 0 && percent < 1 && Math.abs(distance) < hitTargetPadding);
		}
		return false;
	}
}