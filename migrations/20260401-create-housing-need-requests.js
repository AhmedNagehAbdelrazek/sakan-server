'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('housing_need_requests', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      area: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      area_normalized: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      housing_type: {
        type: Sequelize.ENUM('flat', 'room', 'either'),
        allowNull: false,
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('submitted', 'reviewed', 'closed'),
        allowNull: false,
        defaultValue: 'submitted',
      },
      reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      reviewed_by: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      closed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      closed_by: {
        type: Sequelize.UUID,
        allowNull: true,
      },
      createdat: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updatedat: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('housing_need_requests', ['user_id', 'area_normalized', 'housing_type', 'createdat'], {
      name: 'housing_need_requests_user_area_type_createdat_idx',
    });

    await queryInterface.addIndex('housing_need_requests', ['status', 'createdat'], {
      name: 'housing_need_requests_status_createdat_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('housing_need_requests');
  },
};
