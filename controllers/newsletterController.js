const Newsletter = require('../models/newsletterModel');

const subscribe = async (req, res) => {
  try {
    const { email } = req.body;

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).send({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Check if already subscribed
    const existingSubscriber = await Newsletter.findOne({ email });
    if (existingSubscriber) {
      if (existingSubscriber.isActive) {
        return res.status(400).send({
          success: false,
          message: 'Email is already subscribed'
        });
      } else {
        // Reactivate subscription
        existingSubscriber.isActive = true;
        await existingSubscriber.save();
        
        return res.status(200).send({
          success: true,
          message: 'Successfully resubscribed to newsletter'
        });
      }
    }

    // Create new subscription
    const subscriber = new Newsletter({ email });
    await subscriber.save();

    res.status(201).send({
      success: true,
      message: 'Successfully subscribed to newsletter'
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: 'Server error'
    });
  }
};

const unsubscribe = async (req, res) => {
  try {
    const { email } = req.body;

    const subscriber = await Newsletter.findOne({ email });
    
    if (!subscriber) {
      return res.status(404).send({
        success: false,
        message: 'Email not found in our subscription list'
      });
    }

    if (!subscriber.isActive) {
      return res.status(400).send({
        success: false,
        message: 'Email is already unsubscribed'
      });
    }

    subscriber.isActive = false;
    await subscriber.save();

    res.status(200).send({
      success: true,
      message: 'Successfully unsubscribed from newsletter'
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  subscribe,
  unsubscribe
};