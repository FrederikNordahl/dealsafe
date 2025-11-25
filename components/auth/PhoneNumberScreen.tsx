import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

interface PhoneNumberScreenProps {
  onOtpRequested: (phoneNumber: string) => void;
  apiUrl: string;
}

export default function PhoneNumberScreen({ onOtpRequested, apiUrl }: PhoneNumberScreenProps) {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const formatPhoneNumber = (text: string) => {
    // Remove all non-digits
    let digits = text.replace(/\D/g, '');
    
    //Remove coutry code if it exists
    if (digits.startsWith('45')) {
      digits = digits.slice(2);
    }

    if (digits.startsWith('+45')) {
      digits = digits.slice(3);
    }

    // Limit to 8 digits (Danish phone numbers)
    const limited = digits.slice(0, 8);
    
    // Format as XX XX XX XX
    let formatted = '';
    for (let i = 0; i < limited.length; i++) {
      if (i > 0 && i % 2 === 0) {
        formatted += ' ';
      }
      formatted += limited[i];
    }
    
    return formatted;
  };

  const handlePhoneChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    setPhoneNumber(formatted);
  };

  const getFullPhoneNumber = () => {
    const digits = phoneNumber.replace(/\D/g, '');
    return `+45${digits}`;
  };

  const handleRequestOtp = async () => {
    const digits = phoneNumber.replace(/\D/g, '');
    
    if (digits.length !== 8) {
      Alert.alert('Invalid phone number', 'Please enter a valid 8-digit Danish phone number');
      return;
    }

    setIsLoading(true);

    try {
      const fullNumber = getFullPhoneNumber();
      const response = await fetch(`${apiUrl}/api/auth/request-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone_number: fullNumber,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const fullNumber = getFullPhoneNumber();
        
        // Immediately transition to OTP screen
        onOtpRequested(fullNumber);
        
        // Show development code if available (non-blocking)
        if (data.code && __DEV__) {
          setTimeout(() => {
            Alert.alert(
              'Development Code',
              `Your OTP code is: ${data.code}`,
              [{ text: 'OK' }]
            );
          }, 500);
        }
      } else {
        Alert.alert('Error', data.message || 'Failed to send OTP code');
      }
    } catch (error) {
      console.error('Request OTP error:', error);
      Alert.alert('Error', 'Failed to send OTP code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to DealSafe</Text>
        <Text style={styles.subtitle}>Enter your Danish phone number</Text>

        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <View style={styles.prefixContainer}>
              <Text style={styles.prefixText}>🇩🇰 +45</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="12 34 56 78"
              placeholderTextColor="rgba(255, 255, 255, 0.4)"
              value={phoneNumber}
              onChangeText={handlePhoneChange}
              keyboardType="number-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              editable={!isLoading}
              maxLength={11}
              autoFocus
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleRequestOtp}
          disabled={isLoading}
          activeOpacity={0.8}>
          {isLoading ? (
            <ActivityIndicator color="#010101" />
          ) : (
            <Text style={styles.buttonText}>Continue</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.disclaimer}>
          We'll send you a 6-digit verification code via SMS
        </Text>
      </View>
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
  },
  inputContainer: {
    marginTop: 16,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#202020',
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 12,
  },
  prefixContainer: {
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.15)',
  },
  prefixText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  input: {
    flex: 1,
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
    letterSpacing: 1,
    padding: 0,
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
  disclaimer: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    lineHeight: 20,
  },
});

