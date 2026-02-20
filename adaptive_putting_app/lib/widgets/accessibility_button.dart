import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Large, accessible button with haptic feedback
class AccessibilityButton extends StatelessWidget {
  final String label;
  final String semanticsHint;
  final IconData icon;
  final VoidCallback? onPressed;
  final bool isPrimary;
  
  const AccessibilityButton({
    super.key,
    required this.label,
    required this.semanticsHint,
    required this.icon,
    required this.onPressed,
    this.isPrimary = true,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      hint: semanticsHint,
      child: ElevatedButton(
        onPressed: onPressed == null ? null : () {
          HapticFeedback.mediumImpact();
          onPressed!();
        },
        style: ElevatedButton.styleFrom(
          backgroundColor: isPrimary 
              ? Colors.greenAccent 
              : Colors.grey[800],
          foregroundColor: isPrimary 
              ? Colors.black 
              : Colors.white,
          minimumSize: const Size(double.infinity, 80),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
          ),
          elevation: isPrimary ? 8 : 2,
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 32),
            const SizedBox(width: 16),
            Text(
              label,
              style: const TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }
}