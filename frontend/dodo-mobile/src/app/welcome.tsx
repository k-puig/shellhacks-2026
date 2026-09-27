import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../auth/useAuth';

export default function WelcomeScreen() {
    const { login, signUp, isAuthenticated, isLoading } = useAuth();
    const router = useRouter();

    // If a valid session exists or login succeeds, route to Home
    useEffect(() => {
        if (isAuthenticated) {
            router.replace('/screens/home' as any);
        }
    }, [isAuthenticated, router]);

    if (isLoading) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#E3A548" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>DODO</Text>
                <Text style={styles.subtitle}>Hands-free, voice-guided reading</Text>
            </View>

            <View style={styles.buttonContainer}>
                <TouchableOpacity
                    style={[styles.button, styles.primaryButton]}
                    onPress={() => signUp()}
                >
                    <Text style={styles.primaryButtonText}>Sign Up</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={() => login()}
                >
                    <Text style={styles.secondaryButtonText}>Log In</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#15131C',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 56,
    },
    center: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 52,
        fontWeight: '800',
        color: '#E3A548',
        letterSpacing: 3,
    },
    subtitle: {
        fontSize: 16,
        color: '#8B87A0',
        marginTop: 12,
        textAlign: 'center',
    },
    buttonContainer: {
        width: '100%',
        gap: 12,
    },
    button: {
        height: 52,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    primaryButton: {
        backgroundColor: '#E3A548',
    },
    primaryButtonText: {
        color: '#15131C',
        fontSize: 16,
        fontWeight: '700',
    },
    secondaryButton: {
        backgroundColor: '#1F1C29',
        borderWidth: 1,
        borderColor: '#2A2635',
    },
    secondaryButtonText: {
        color: '#F2EDE4',
        fontSize: 16,
        fontWeight: '600',
    },
});