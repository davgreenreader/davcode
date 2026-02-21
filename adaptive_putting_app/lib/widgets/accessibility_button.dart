import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// High contrast, accessible button with icon and label
/// Meets VI design standards: large text, high contrast, icon + label
class AccessibilityButton extends StatelessWidget {
  final String label;
  final String semanticsHint;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool isPrimary;
  final ButtonStyle? customStyle;
  
  const AccessibilityButton({
    super.key,
    required this.label,
    required this.semanticsHint,
    required this.icon,
    required this.onPressed,
    this.isPrimary = true,
    this.customStyle,
  });

  @override
  Widget build(BuildContext context) {
    // High contrast colors
    final Color backgroundColor;
    final Color foregroundColor;
    final Color borderColor;
    
    if (isPrimary) {
      // Primary: Black background, white text
      backgroundColor = const Color(0xFF000000);
      foregroundColor = const Color(0xFFFFFFFF);
      borderColor = const Color(0xFF000000);
    } else {
      // Secondary: White background, black text, black border
      backgroundColor = const Color(0xFFFFFFFF);
      foregroundColor = const Color(0xFF000000);
      borderColor = const Color(0xFF000000);
    }
    
    return Semantics(
      button: true,
      label: label,
      hint: semanticsHint,
      child: Container(
        // Add slight margin for visual separation
        margin: const EdgeInsets.symmetric(vertical: 4),
        child: ElevatedButton(
          onPressed: onPressed == null ? null : () {
            HapticFeedback.mediumImpact();
            onPressed!();
          },
          style: customStyle ?? ElevatedButton.styleFrom(
            backgroundColor: backgroundColor,
            foregroundColor: foregroundColor,
            disabledBackgroundColor: const Color(0xFFCCCCCC),
            disabledForegroundColor: const Color(0xFF666666),
            minimumSize: const Size(double.infinity, 80),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
              side: BorderSide(color: borderColor, width: 3),
            ),
            elevation: 0,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              // Icon with label - never rely on icon alone
              Icon(
                icon, 
                size: 32,
                color: foregroundColor,
              ),
              const SizedBox(width: 16),
              // Large, clear text
              Flexible(
                child: Text(
                  label,
                  style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: foregroundColor,
                    fontFamily: 'Arial',
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Status indicator with icon, label, and color
/// Uses redundant signaling: color + icon + text
class StatusIndicator extends StatelessWidget {
  final String label;
  final StatusType status;
  
  const StatusIndicator({
    super.key,
    required this.label,
    required this.status,
  });

  @override
  Widget build(BuildContext context) {
    IconData icon;
    Color backgroundColor;
    Color foregroundColor;
    String statusText;
    
    switch (status) {
      case StatusType.success:
        icon = Icons.check_circle;
        backgroundColor = const Color(0xFF006600);  // Dark green
        foregroundColor = const Color(0xFFFFFFFF);
        statusText = '✓ $label';
        break;
      case StatusType.warning:
        icon = Icons.warning;
        backgroundColor = const Color(0xFFFFCC00);  // Yellow
        foregroundColor = const Color(0xFF000000);
        statusText = '⚠ $label';
        break;
      case StatusType.error:
        icon = Icons.error;
        backgroundColor = const Color(0xFFCC0000);  // Dark red
        foregroundColor = const Color(0xFFFFFFFF);
        statusText = '✗ $label';
        break;
      case StatusType.info:
        icon = Icons.info;
        backgroundColor = const Color(0xFF0000AA);  // Dark blue
        foregroundColor = const Color(0xFFFFFFFF);
        statusText = 'ℹ $label';
        break;
      case StatusType.neutral:
        icon = Icons.circle_outlined;
        backgroundColor = const Color(0xFFFFFFFF);
        foregroundColor = const Color(0xFF000000);
        statusText = label;
        break;
    }
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFF000000), width: 2),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: foregroundColor, size: 28),
          const SizedBox(width: 12),
          Text(
            statusText,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: foregroundColor,
              fontFamily: 'Arial',
            ),
          ),
        ],
      ),
    );
  }
}

enum StatusType {
  success,
  warning,
  error,
  info,
  neutral,
}