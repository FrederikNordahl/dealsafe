import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { User } from '../../utils/auth';

interface OtpScreenProps {
  phoneNumber: string;
  onVerified: (token: string, user: User) => void;
  onBack: () => void;
  apiUrl: string;
}

export default function OtpScreen({ phoneNumber, onVerified, onBack, apiUrl }: OtpScreenProps) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [isRequestingNewCode, setIsRequestingNewCode] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    inputRefs.current[0]?.focus();
  }, []);

  const handleOtpChange = (text: string, index: number) => {
    // Only allow digits
    const digits = text.replace(/[^0-9]/g, '');

    console.log('digits', digits);
    
    // Handle paste or multi-character input
    if (digits.length > 1) {
      console.log('digits', digits);
      // Take first 6 digits and fill from the beginning
      const digitArray = digits.slice(0, 6).split('');
      const newOtp = ['', '', '', '', '', ''];
      
      // Fill all 6 positions
      digitArray.forEach((d, i) => {
        if (i < 6) {
          newOtp[i] = d;
        }
      });
      
      setOtp(newOtp);
      
      // Focus the last filled input
      const lastFilledIndex = Math.min(digitArray.length - 1, 5);
      setTimeout(() => {
        inputRefs.current[lastFilledIndex]?.focus();
      }, 50);
      
      // Auto-submit if all 6 digits are filled
      if (digitArray.length === 6) {
        setTimeout(() => handleVerifyOtp(newOtp.join('')), 200);
      }
      return;
    }

    // Handle single digit input
    const newOtp = [...otp];
    newOtp[index] = digits;
    setOtp(newOtp);

    // Move to next input if digit entered
    if (digits && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit if all 6 digits are filled
    if (digits && index === 5 && newOtp.every(d => d !== '')) {
      setTimeout(() => handleVerifyOtp(newOtp.join('')), 100);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = async (code?: string) => {
    const otpCode = code || otp.join('');
    
    if (otpCode.length !== 6) {
      Alert.alert('Invalid code', 'Please enter all 6 digits');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${apiUrl}/api/auth/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
          code: otpCode,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onVerified(data.token, data.user);
      } else {
        // Show error modal instead of alert
        setShowErrorModal(true);
        // Clear OTP inputs
        setOtp(['', '', '', '', '', '']);
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      // Show error modal instead of alert
      setShowErrorModal(true);
      setOtp(['', '', '', '', '', '']);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTryAgain = () => {
    setShowErrorModal(false);
    inputRefs.current[0]?.focus();
  };

  const handleRequestNewCode = async () => {
    setIsRequestingNewCode(true);
    setShowErrorModal(false);
    
    try {
      const response = await fetch(`${apiUrl}/api/auth/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: phoneNumber,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Clear OTP inputs
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        
        // Show development code if available (non-blocking)
        if (data.code && __DEV__) {
          setTimeout(() => {
            Alert.alert(
              'Development Code',
              `Your new OTP code is: ${data.code}`,
              [{ text: 'OK' }]
            );
          }, 500);
        }
      } else {
        Alert.alert('Error', data.message || 'Failed to send new OTP code');
      }
    } catch (error) {
      console.error('Request new OTP error:', error);
      Alert.alert('Error', 'Failed to send new OTP code. Please try again.');
    } finally {
      setIsRequestingNewCode(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Enter verification code</Text>
        <Text style={styles.subtitle}>
          We sent a 6-digit code to{'\n'}
          <Text style={styles.phoneNumber}>{phoneNumber}</Text>
        </Text>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              style={[styles.otpInput, digit !== '' && styles.otpInputFilled]}
              value={digit}
              onChangeText={(text) => handleOtpChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              selectTextOnFocus
              editable={!isLoading}
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={() => handleVerifyOtp()}
          disabled={isLoading}
          activeOpacity={0.8}>
          {isLoading ? (
            <ActivityIndicator color="#010101" />
          ) : (
            <Text style={styles.buttonText}>Verify</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          disabled={isLoading || isRequestingNewCode}
          activeOpacity={0.7}>
          <Text style={styles.backButtonText}>Change phone number</Text>
        </TouchableOpacity>
      </View>

      {/* Error Modal */}
      <Modal
        visible={showErrorModal}
        transparent
        animationType="fade"
        onRequestClose={handleTryAgain}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Error</Text>
            <Text style={styles.modalMessage}>
              The code is incorrect or expired
            </Text>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={handleTryAgain}
                activeOpacity={0.8}>
                <Text style={styles.modalButtonTextCancel}>Try again</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonPrimary]}
                onPress={handleRequestNewCode}
                disabled={isRequestingNewCode}
                activeOpacity={0.8}>
                {isRequestingNewCode ? (
                  <ActivityIndicator color="#010101" />
                ) : (
                  <Text style={styles.modalButtonTextPrimary}>Request new code</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#010101',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    gap: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  phoneNumber: {
    fontWeight: '600',
    color: '#FFFFFF',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
    marginBottom: 8,
  },
  otpInput: {
    width: 48,
    height: 56,
    backgroundColor: '#202020',
    borderRadius: 16,
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  otpInputFilled: {
    borderColor: '#FFFFFF',
    backgroundColor: '#2A2A2A',
  },
  button: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#010101',
  },
  backButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.7)',
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: '#202020',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    minHeight: 48,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalButtonPrimary: {
    backgroundColor: '#FFFFFF',
  },
  modalButtonTextCancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  modalButtonTextPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: '#010101',
    textAlign: 'center',
  },
});

