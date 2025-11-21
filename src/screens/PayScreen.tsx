// src/screens/PayScreen.tsx - FULL UPDATED CODE
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { payGoalStk, formatPhoneNumber, validateMpesaPhone } from '../lib/payments';

interface PayScreenProps {
  route?: any;
  navigation?: any;
}

const PayScreen: React.FC<PayScreenProps> = ({ route, navigation }) => {
  // Get goal data from navigation params if available
  const goal = route?.params?.goal || {};
  
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{phone?: string; amount?: string}>({});

  // Initialize with goal data if available
  useEffect(() => {
    if (goal?.id) {
      setReference(`GOAL${goal.id.slice(0, 8)}`);
      if (goal.target_amount) {
        setAmount(goal.target_amount.toString());
      }
    }
  }, [goal]);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: {phone?: string; amount?: string} = {};

    // Phone validation
    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!validateMpesaPhone(phone)) {
      newErrors.phone = 'Please enter a valid MPESA phone number (format: 07XXXXXXXX or 2547XXXXXXXX)';
    }

    // Amount validation
    if (!amount.trim()) {
      newErrors.amount = 'Amount is required';
    } else {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum < 1) {
        newErrors.amount = 'Amount must be at least 1 KSH';
      } else if (amountNum > 150000) {
        newErrors.amount = 'Amount cannot exceed 150,000 KSH';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Format phone number as user types
  const handlePhoneChange = (text: string) => {
    setPhone(text);
    // Clear error when user starts typing
    if (errors.phone) {
      setErrors({...errors, phone: undefined});
    }
  };

  // Format amount as user types
  const handleAmountChange = (text: string) => {
    // Only allow numbers and decimal point
    const cleaned = text.replace(/[^0-9.]/g, '');
    setAmount(cleaned);
    // Clear error when user starts typing
    if (errors.amount) {
      setErrors({...errors, amount: undefined});
    }
  };

  // Handle payment submission
  const onSubmit = async () => {
    // Hide keyboard
    if (Platform.OS === 'web') {
      const activeElement = document.activeElement as HTMLElement;
      activeElement?.blur();
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    
    try {
      console.log('Payment attempt:', { 
        phone: formatPhoneNumber(phone), 
        amount: parseFloat(amount), 
        reference 
      });

      const result = await payGoalStk(
        phone, 
        parseFloat(amount), 
        goal.id || reference
      );
      
      if (result.success) {
        console.log('Payment initiated successfully:', result);
        
        Alert.alert(
          'Payment Initiated',
          result.message || 'Please check your phone to complete the MPESA payment.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate back or to success screen
                if (navigation) {
                  navigation.goBack();
                }
              },
            },
          ]
        );
        
      } else {
        console.error('Payment failed:', result.message);
        Alert.alert(
          'Payment Failed',
          result.message || 'Failed to initiate payment. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please check your connection and try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  // Quick amount buttons
  const quickAmounts = [100, 500, 1000, 2000, 5000];

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Make Payment</Text>
          <Text style={styles.subtitle}>
            {goal.name ? `For: ${goal.name}` : 'Enter payment details'}
          </Text>
        </View>

        <View style={styles.form}>
          {/* Phone Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>MPESA Phone Number</Text>
            <TextInput
              style={[
                styles.input,
                errors.phone && styles.inputError
              ]}
              placeholder="07XXXXXXXX or 2547XXXXXXXX"
              value={phone}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
              autoCapitalize="none"
              editable={!loading}
            />
            {errors.phone && (
              <Text style={styles.errorText}>{errors.phone}</Text>
            )}
            <Text style={styles.helperText}>
              Enter the phone number registered with MPESA
            </Text>
          </View>

          {/* Amount Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Amount (KSH)</Text>
            <TextInput
              style={[
                styles.input,
                errors.amount && styles.inputError
              ]}
              placeholder="Enter amount"
              value={amount}
              onChangeText={handleAmountChange}
              keyboardType="decimal-pad"
              editable={!loading}
            />
            {errors.amount && (
              <Text style={styles.errorText}>{errors.amount}</Text>
            )}
            
            {/* Quick Amount Buttons */}
            <View style={styles.quickAmountsContainer}>
              <Text style={styles.quickAmountsLabel}>Quick select:</Text>
              <View style={styles.quickAmounts}>
                {quickAmounts.map((quickAmount) => (
                  <TouchableOpacity
                    key={quickAmount}
                    style={[
                      styles.quickAmountButton,
                      amount === quickAmount.toString() && styles.quickAmountButtonActive
                    ]}
                    onPress={() => {
                      setAmount(quickAmount.toString());
                      if (errors.amount) {
                        setErrors({...errors, amount: undefined});
                      }
                    }}
                    disabled={loading}
                  >
                    <Text style={[
                      styles.quickAmountText,
                      amount === quickAmount.toString() && styles.quickAmountTextActive
                    ]}>
                      {quickAmount.toLocaleString()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Reference Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Payment Reference</Text>
            <TextInput
              style={styles.input}
              placeholder="Payment reference"
              value={reference}
              onChangeText={setReference}
              editable={!loading}
            />
            <Text style={styles.helperText}>
              This will appear on your MPESA statement
            </Text>
          </View>

          {/* Payment Button */}
          <TouchableOpacity
            style={[
              styles.payButton,
              loading && styles.payButtonDisabled
            ]}
            onPress={onSubmit}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#FFFFFF" />
                <Text style={styles.payButtonTextLoading}>
                  Processing...
                </Text>
              </View>
            ) : (
              <Text style={styles.payButtonText}>
                Pay KES {parseFloat(amount || '0').toLocaleString()}
              </Text>
            )}
          </TouchableOpacity>

          {/* Info Section */}
          <View style={styles.infoSection}>
            <Text style={styles.infoTitle}>How to pay:</Text>
            <View style={styles.infoSteps}>
              <Text style={styles.infoStep}>1. Enter your MPESA registered phone number</Text>
              <Text style={styles.infoStep}>2. Enter the amount you want to pay</Text>
              <Text style={styles.infoStep}>3. Tap "Pay" to initiate payment</Text>
              <Text style={styles.infoStep}>4. Check your phone for MPESA prompt</Text>
              <Text style={styles.infoStep}>5. Enter your MPESA PIN to complete</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  inputError: {
    borderColor: '#dc3545',
  },
  errorText: {
    color: '#dc3545',
    fontSize: 14,
    marginTop: 4,
  },
  helperText: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  quickAmountsContainer: {
    marginTop: 12,
  },
  quickAmountsLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  quickAmounts: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAmountButton: {
    backgroundColor: '#f8f9fa',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#dee2e6',
  },
  quickAmountButtonActive: {
    backgroundColor: '#007bff',
    borderColor: '#007bff',
  },
  quickAmountText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  quickAmountTextActive: {
    color: '#fff',
  },
  payButton: {
    backgroundColor: '#28a745',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  payButtonDisabled: {
    backgroundColor: '#6c757d',
    opacity: 0.7,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  payButtonTextLoading: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoSection: {
    backgroundColor: '#e7f3ff',
    borderRadius: 8,
    padding: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0056b3',
    marginBottom: 8,
  },
  infoSteps: {
    gap: 4,
  },
  infoStep: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
});

export default PayScreen;